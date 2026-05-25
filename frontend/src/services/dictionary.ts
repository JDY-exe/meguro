import type { DictionaryExample, DictionaryMetadata, DictionarySense, DictionarySenseGroup, DictionaryTag, DictionaryWordResult, DictionaryXref } from "../types/cards.js";

export const DEFAULT_JITENDEX_URL = "https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip";
export const JITENDEX_ATTRIBUTION = "Jitendex by Stephen Kraus, derived from JMdict and Tatoeba data, licensed under CC BY-SA 4.0.";

interface DictionaryStatusResponse {
  state: "loading" | "ready" | "error";
  metadata: DictionaryMetadata | null;
  error: string | null;
  entryCount: number;
}

interface StoredEntry {
  id: string;
  term: string;
  reading: string;
  senseGroups: DictionarySenseGroup[];
  termScore: number;
  priorityRank: number;
  importOrder: number;
  searchable: string;
}

interface SearchRank {
  score: number;
  matchKind: number;
  exactTerm: number;
}

const API_BASE = (import.meta as ImportMeta & { env?: { VITE_DICTIONARY_API_BASE?: string } }).env?.VITE_DICTIONARY_API_BASE ?? "";

export async function getDictionaryStatus(): Promise<DictionaryStatusResponse> {
  return apiGet<DictionaryStatusResponse>("/api/dictionary/status");
}

export async function getDictionaryMetadata(): Promise<DictionaryMetadata | null> {
  const status = await getDictionaryStatus();
  return status.state === "ready" ? status.metadata : null;
}

export async function searchDictionaryHeadwords(query: string, limit = 8): Promise<DictionaryWordResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiGet<DictionaryWordResult[]>(`/api/dictionary/headwords?${params.toString()}`);
}

export async function hydrateDictionaryEntries(ids: string[]): Promise<DictionaryWordResult[]> {
  return apiPost<DictionaryWordResult[]>("/api/dictionary/entries", { ids });
}

export async function reindexDictionary(): Promise<void> {
  await apiPost("/api/dictionary/reindex", {});
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  return parseApiResponse<T>(response);
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const errorMessage = isRecord(payload) && typeof payload.error === "string" ? payload.error : `Dictionary request failed with HTTP ${response.status}.`;
    throw new Error(errorMessage);
  }
  return payload as T;
}

export function parseJitendexGlossary(value: unknown, entryId = "entry"): DictionarySenseGroup[] {
  return collectNodesByKind(value, "sense-group")
    .map((node, groupIndex) => parseSenseGroup(node, `${entryId}:group:${groupIndex}`))
    .filter((group) => group.senses.length > 0);
}

export function __testRankDictionaryEntries(
  entries: Array<{ term: string; reading: string; termScore: number; definitionTags: string; importOrder: number }>,
  query: string,
): Array<{ term: string; reading: string }> {
  const normalizedQuery = normalize(query);
  return entries
    .map((entry) => {
      const storedEntry: StoredEntry = {
        id: stableWordId(entry.term, entry.reading, entry.term),
        term: entry.term,
        reading: entry.reading,
        senseGroups: [],
        termScore: entry.termScore,
        priorityRank: priorityRank(entry.definitionTags, entry.termScore),
        importOrder: entry.importOrder,
        searchable: normalize(`${entry.term} ${entry.reading}`),
      };
      return { entry: storedEntry, rank: rankEntry(storedEntry, normalizedQuery) };
    })
    .filter((item) => item.rank.score > 0)
    .sort(compareRankedEntries)
    .map(({ entry }) => ({ term: entry.term, reading: entry.reading }));
}

function parseSenseGroup(node: Record<string, unknown>, groupId: string): DictionarySenseGroup {
  const tagNodes = directChildren(node).filter((child) => {
    const kind = structuredContentKind(child);
    return kind === "part-of-speech-info" || kind === "misc-info";
  });
  const tags = uniqueTags(tagNodes.map(parseTag));
  const senses = collectNodesByKind(node.content, "sense")
    .map((senseNode, senseIndex) => parseSense(senseNode, `${groupId}:sense:${senseIndex}`, senseIndex))
    .filter((sense) => sense.glosses.length > 0);
  const partOfSpeech = tags.filter((tag) => tag.category === "partOfSpeech");
  const verbTypes = partOfSpeech.filter((tag) => /^v/.test(tag.code));
  const misc = tags.filter((tag) => tag.category === "misc");

  return { id: groupId, tags, partOfSpeech, verbTypes, misc, senses };
}

function parseSense(node: Record<string, unknown>, senseId: string, index: number): DictionarySense {
  return {
    id: senseId,
    glosses: uniqueStrings(collectNodesByKind(node.content, "glossary").flatMap((glossary) => collectListItemTexts(glossary.content))),
    examples: collectNodesByKind(node.content, "example-sentence").map(parseExample).filter((example) => example.japanese || example.english),
    notes: uniqueStrings(collectNodesByKind(node.content, "sense-note").map(parseNote).filter(Boolean)),
    xrefs: uniqueXrefs(collectNodesByKind(node.content, "xref").map(parseXref).filter((xref) => xref.target)),
    index,
  };
}

function parseTag(node: Record<string, unknown>): DictionaryTag {
  const data = isRecord(node.data) ? node.data : {};
  const kind = structuredContentKind(node);
  const code = String(data.code ?? textFromNode(node)).trim();
  return {
    code,
    label: cleanExtractedText(textFromNode(node)),
    title: typeof node.title === "string" ? node.title : "",
    category: kind === "part-of-speech-info" ? "partOfSpeech" : "misc",
  };
}

function parseExample(node: Record<string, unknown>): DictionaryExample {
  const japanese = collectNodesByKind(node.content, "example-sentence-a").map((item) => textFromNode(item)).find(Boolean) ?? "";
  const english = collectNodesByKind(node.content, "example-sentence-b").map((item) => textFromNode(item)).find(Boolean) ?? "";
  return { japanese, english };
}

function parseNote(node: Record<string, unknown>): string {
  const content = collectNodesByKind(node.content, "sense-note-content").map((item) => textFromNode(item)).find(Boolean);
  return content ?? textFromNode(node);
}

function parseXref(node: Record<string, unknown>): DictionaryXref {
  const xrefContent = collectNodesByKind(node.content, "xref-content")[0] ?? node;
  const label = collectNodesByKind(xrefContent.content, "reference-label").map((item) => textFromNode(item)).find(Boolean) ?? "See also";
  const target = collectNodesByTag(xrefContent.content, "a").map((item) => textFromNode(item)).find(Boolean) ?? textFromNode(xrefContent);
  return { label, target };
}

function collectNodesByKind(value: unknown, kind: string): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap((item) => collectNodesByKind(item, kind));
  if (!isRecord(value)) return [];
  const matches = structuredContentKind(value) === kind ? [value] : [];
  return [...matches, ...collectNodesByKind(value.content, kind)];
}

function collectNodesByTag(value: unknown, tag: string): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap((item) => collectNodesByTag(item, tag));
  if (!isRecord(value)) return [];
  const matches = value.tag === tag ? [value] : [];
  return [...matches, ...collectNodesByTag(value.content, tag)];
}

function collectListItemTexts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectListItemTexts);
  if (!isRecord(value)) return typeof value === "string" ? [cleanExtractedText(value)] : [];
  if (value.tag === "li") return [textFromNode(value)].filter(Boolean);
  return collectListItemTexts(value.content);
}

function directChildren(node: Record<string, unknown>): Array<Record<string, unknown>> {
  const content = node.content;
  if (Array.isArray(content)) return content.filter(isRecord);
  return isRecord(content) ? [content] : [];
}

function textFromNode(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return cleanExtractedText(value.map(textFromNode).join(""));
  if (!isRecord(value)) return "";
  if (structuredContentKind(value) === "attribution-footnote") return "";
  if (value.tag === "rt" || value.tag === "rp" || value.tag === "img") return "";
  if (typeof value.text === "string") return cleanExtractedText(value.text);
  return textFromNode(value.content);
}

function structuredContentKind(value: Record<string, unknown>): string {
  const data = isRecord(value.data) ? value.data : {};
  const rawKind = data["sc-content"] ?? data.scContent ?? data.content ?? data.type ?? value.type ?? "";
  return typeof rawKind === "string" ? rawKind : "";
}

function compareRankedEntries(a: { entry: StoredEntry; rank: SearchRank }, b: { entry: StoredEntry; rank: SearchRank }): number {
  let delta = b.rank.matchKind - a.rank.matchKind;
  if (delta !== 0) return delta;
  delta = b.rank.exactTerm - a.rank.exactTerm;
  if (delta !== 0) return delta;
  delta = b.entry.priorityRank - a.entry.priorityRank;
  if (delta !== 0) return delta;
  delta = b.entry.termScore - a.entry.termScore;
  if (delta !== 0) return delta;
  delta = a.entry.importOrder - b.entry.importOrder;
  if (delta !== 0) return delta;
  delta = b.entry.term.length - a.entry.term.length;
  if (delta !== 0) return delta;
  return a.entry.term.localeCompare(b.entry.term);
}

function rankEntry(entry: StoredEntry, query: string): SearchRank {
  const term = normalize(entry.term);
  const reading = normalize(entry.reading);
  if (term === query) return { score: 100, matchKind: 7, exactTerm: 1 };
  if (reading === query) return { score: 95, matchKind: 6, exactTerm: 0 };
  if (term.startsWith(query)) return { score: 80, matchKind: 5, exactTerm: 0 };
  if (reading.startsWith(query)) return { score: 75, matchKind: 4, exactTerm: 0 };
  if (term.includes(query)) return { score: 60, matchKind: 3, exactTerm: 0 };
  if (reading.includes(query)) return { score: 55, matchKind: 2, exactTerm: 0 };
  if (entry.searchable.includes(query)) return { score: 25, matchKind: 1, exactTerm: 0 };
  return fuzzyIncludes(entry.searchable, query) ? { score: 10, matchKind: 0, exactTerm: 0 } : { score: 0, matchKind: -1, exactTerm: 0 };
}

function priorityRank(definitionTags: string, termScore: number): number {
  if (/priority/i.test(definitionTags)) return 4;
  if (definitionTags.includes("★")) return 3;
  if (definitionTags.includes("â˜…")) return 3;
  if (termScore > 0) return 2;
  if (/rare|old|obsolete/i.test(definitionTags) || termScore < 0) return -1;
  return 0;
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

function stableWordId(term: string, reading: string, fallbackId: string): string {
  const normalizedTerm = normalize(term);
  const normalizedReading = normalize(reading);
  return normalizedTerm || normalizedReading ? `${normalizedTerm}:${normalizedReading}` : fallbackId;
}

function uniqueTags(tags: DictionaryTag[]): DictionaryTag[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = `${tag.category}:${tag.code}:${tag.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(cleanExtractedText).filter(Boolean))];
}

function uniqueXrefs(values: DictionaryXref[]): DictionaryXref[] {
  const seen = new Set<string>();
  return values.filter((xref) => {
    const key = `${xref.label}:${xref.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}
