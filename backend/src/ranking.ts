import type { DictionaryWordResult, StoredEntry, StoredHeadword } from "./types.js";
import { normalize } from "./text.js";

interface SearchRank {
  score: number;
  matchKind: number;
  exactTerm: number;
}

interface RankedHeadword {
  headword: StoredHeadword;
  rank: SearchRank;
}

export function searchHeadwords(headwords: StoredHeadword[], rawQuery: string, limit: number): DictionaryWordResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const ranked: RankedHeadword[] = [];
  for (const headword of headwords) {
    addRankedHeadwordEntry(ranked, headword, query, limit);
  }
  return ranked.map(({ headword, rank }) => ({
    id: headword.id,
    term: headword.term,
    reading: headword.reading,
    senseGroups: [],
    termScore: headword.termScore,
    score: rank.score,
    source: "jitendex",
  }));
}

export function hydrateEntries(ids: string[], entriesById: Map<string, StoredEntry>): DictionaryWordResult[] {
  return ids.flatMap((id) => {
    const entry = entriesById.get(id);
    if (!entry) return [];
    return [{
      id: entry.id,
      term: entry.term,
      reading: entry.reading,
      senseGroups: entry.senseGroups,
      termScore: entry.termScore,
      score: 0,
      source: "jitendex" as const,
    }];
  });
}

export function entryToHeadword(entry: StoredEntry): StoredHeadword {
  return {
    id: entry.id,
    term: entry.term,
    reading: entry.reading,
    termScore: entry.termScore,
    priorityRank: entry.priorityRank,
    importOrder: entry.importOrder,
    searchable: normalize(`${entry.term} ${entry.reading}`),
  };
}

export function priorityRank(definitionTags: string, termScore: number): number {
  if (/priority/i.test(definitionTags)) return 4;
  if (definitionTags.includes("★")) return 3;
  if (definitionTags.includes("â˜…")) return 3;
  if (termScore > 0) return 2;
  if (/rare|old|obsolete/i.test(definitionTags) || termScore < 0) return -1;
  return 0;
}

function addRankedHeadwordEntry(ranked: RankedHeadword[], headword: StoredHeadword, query: string, limit: number): void {
  const rank = rankHeadwordEntry(headword, query);
  if (rank.score <= 0) return;
  ranked.push({ headword, rank });
  ranked.sort(compareRankedHeadwords);
  if (ranked.length > limit) ranked.length = limit;
}

function rankHeadwordEntry(headword: StoredHeadword, query: string): SearchRank {
  const term = normalize(headword.term);
  const reading = normalize(headword.reading);
  if (term === query) return { score: 100, matchKind: 7, exactTerm: 1 };
  if (reading === query) return { score: 95, matchKind: 6, exactTerm: 0 };
  if (term.startsWith(query)) return { score: 80, matchKind: 5, exactTerm: 0 };
  if (reading.startsWith(query)) return { score: 75, matchKind: 4, exactTerm: 0 };
  if (term.includes(query)) return { score: 60, matchKind: 3, exactTerm: 0 };
  if (reading.includes(query)) return { score: 55, matchKind: 2, exactTerm: 0 };
  return fuzzyIncludes(`${term}${reading}`, query) ? { score: 10, matchKind: 0, exactTerm: 0 } : { score: 0, matchKind: -1, exactTerm: 0 };
}

function compareRankedHeadwords(a: RankedHeadword, b: RankedHeadword): number {
  let delta = b.rank.matchKind - a.rank.matchKind;
  if (delta !== 0) return delta;
  delta = b.rank.exactTerm - a.rank.exactTerm;
  if (delta !== 0) return delta;
  delta = b.headword.priorityRank - a.headword.priorityRank;
  if (delta !== 0) return delta;
  delta = b.headword.termScore - a.headword.termScore;
  if (delta !== 0) return delta;
  delta = a.headword.importOrder - b.headword.importOrder;
  if (delta !== 0) return delta;
  delta = b.headword.term.length - a.headword.term.length;
  if (delta !== 0) return delta;
  return a.headword.term.localeCompare(b.headword.term);
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) {
      index += 1;
      if (index === needle.length) return true;
    }
  }
  return false;
}
