import type { DictionaryExample, DictionaryMetadata, DictionarySense, DictionarySenseGroup, DictionaryTag, DictionaryWordResult, DictionaryXref } from "../types/cards.js";

const DB_NAME = "meguro-dictionary";
const DB_VERSION = 7;
const INDEX_STORE = "entries";
const HEADWORD_STORE = "headwords";
const META_STORE = "metadata";
const META_KEY = "jitendex";

export const DEFAULT_JITENDEX_URL = "https://github.com/stephenmk/Jitendex/releases/latest/download/jitendex-yomitan.zip";
export const JITENDEX_ATTRIBUTION = "Jitendex by Stephen Kraus, derived from JMdict and Tatoeba data, licensed under CC BY-SA 4.0.";

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

interface StoredHeadword {
  id: string;
  term: string;
  reading: string;
  termScore: number;
  priorityRank: number;
  importOrder: number;
  searchable: string;
}

type YomitanTerm = [string, string, string, string, number, unknown[], number, string?];

interface RankedEntry {
  entry: StoredEntry;
  rank: SearchRank;
}

interface RankedHeadword {
  headword: StoredHeadword;
  rank: SearchRank;
}

interface SearchRank {
  score: number;
  matchKind: number;
  exactTerm: number;
}

let cachedEntries: StoredEntry[] | null = null;
let cachedHeadwords: StoredHeadword[] | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        db.createObjectStore(INDEX_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(HEADWORD_STORE)) {
        db.createObjectStore(HEADWORD_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
      const tx = request.transaction;
      if (tx) {
        tx.objectStore(INDEX_STORE).clear();
        tx.objectStore(HEADWORD_STORE).clear();
        tx.objectStore(META_STORE).clear();
      }
    };
    request.onerror = () => reject(databaseError("open the local dictionary", request.error));
    request.onblocked = () => reject(new Error("The local dictionary is blocked by another open tab. Close other Meguro tabs, then try again."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(databaseError("finish the local dictionary update", tx.error));
    tx.onabort = () => reject(databaseError("finish the local dictionary update", tx.error));
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(databaseError("clear the local dictionary", request.error));
    request.onblocked = () => reject(new Error("The local dictionary is blocked by another open tab. Close other Meguro tabs, then try clearing it again."));
    request.onsuccess = () => resolve();
  });
}

export async function getDictionaryMetadata(): Promise<DictionaryMetadata | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const request = tx.objectStore(META_STORE).get(META_KEY);
    request.onerror = () => {
      db.close();
      reject(databaseError("read the saved dictionary metadata", request.error));
    };
    request.onsuccess = () => {
      db.close();
      resolve(request.result?.metadata ?? null);
    };
  });
}

export async function clearDictionary(): Promise<void> {
  await deleteDatabase();
  cachedEntries = null;
  cachedHeadwords = null;
}

export async function searchDictionary(query: string, limit = 8): Promise<DictionaryWordResult[]> {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  const headwords = await getRankedHeadwords(normalizedQuery, limit);
  return hydrateRankedHeadwords(headwords);
}

export async function searchDictionaryHeadwords(query: string, limit = 8): Promise<DictionaryWordResult[]> {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  return formatRankedHeadwords(await getRankedHeadwords(normalizedQuery, limit));
}

export async function downloadAndIndexDictionary(sourceUrl: string, onProgress?: (message: string) => void): Promise<DictionaryMetadata> {
  onProgress?.("Downloading Jitendex dictionary zip...");
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Dictionary download failed with HTTP ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  return indexDictionaryBuffer(buffer, sourceUrl, onProgress);
}

export async function indexDictionaryBuffer(buffer: ArrayBuffer, sourceUrl: string, onProgress?: (message: string) => void): Promise<DictionaryMetadata> {
  onProgress?.("Reading dictionary archive...");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const indexFile = zip.file("index.json");
  const index = indexFile ? JSON.parse(await indexFile.async("string")) : {};
  const version = String(index.revision || index.title || "Jitendex");

  const termFiles = Object.values(zip.files).filter((file) => /^term_bank_\d+\.json$/.test(file.name));
  if (termFiles.length === 0) {
    throw new Error("No term_bank_*.json files were found in the dictionary archive.");
  }

  const groupedEntries = new Map<string, StoredEntry>();
  let importOrder = 0;
  for (let fileIndex = 0; fileIndex < termFiles.length; fileIndex += 1) {
    const file = termFiles[fileIndex];
    onProgress?.(`Indexing ${file.name} (${fileIndex + 1}/${termFiles.length})...`);
    const rows = JSON.parse(await file.async("string")) as YomitanTerm[];
    rows.forEach((row, rowIndex) => {
      mergeYomitanRow(groupedEntries, row, `${file.name}:${rowIndex}`, importOrder);
      importOrder += 1;
    });
  }
  const entries = [...groupedEntries.values()];

  onProgress?.("Saving dictionary index locally...");
  await replaceEntries(entries, {
    version,
    sourceUrl,
    attribution: JITENDEX_ATTRIBUTION,
    indexedAt: new Date().toISOString(),
    entryCount: entries.length,
  });

  const metadata = await getDictionaryMetadata();
  if (!metadata) {
    throw new Error("Dictionary metadata was not saved.");
  }
  return metadata;
}

async function replaceEntries(entries: StoredEntry[], metadata: DictionaryMetadata): Promise<void> {
  const headwords = entries.map(entryToHeadword);
  const db = await openDatabase();
  const tx = db.transaction([INDEX_STORE, HEADWORD_STORE, META_STORE], "readwrite");
  const entryStore = tx.objectStore(INDEX_STORE);
  const headwordStore = tx.objectStore(HEADWORD_STORE);
  const metaStore = tx.objectStore(META_STORE);
  entryStore.clear();
  headwordStore.clear();
  metaStore.clear();
  entries.forEach((entry) => entryStore.put(entry));
  headwords.forEach((headword) => headwordStore.put(headword));
  metaStore.put({ key: META_KEY, metadata });
  await txDone(tx);
  db.close();
  cachedEntries = entries;
  cachedHeadwords = headwords;
}

function getRankedHeadwords(query: string, limit: number): Promise<RankedHeadword[]> {
  if (cachedHeadwords) {
    return Promise.resolve(rankHeadwords(cachedHeadwords, query, limit));
  }

  return searchPersistedHeadwords(query, limit);
}

function hydrateRankedHeadwords(rankedHeadwords: RankedHeadword[]): Promise<DictionaryWordResult[]> {
  if (rankedHeadwords.length === 0) {
    return Promise.resolve([]);
  }

  if (cachedEntries) {
    const entriesById = new Map(cachedEntries.map((entry) => [entry.id, entry]));
    return Promise.resolve(formatHydratedHeadwords(rankedHeadwords, (id) => entriesById.get(id) ?? null));
  }

  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const entries = new Map<string, StoredEntry>();
        const tx = db.transaction(INDEX_STORE, "readonly");
        const store = tx.objectStore(INDEX_STORE);

        rankedHeadwords.forEach(({ headword }) => {
          const request = store.get(headword.id);
          request.onsuccess = () => {
            if (request.result) {
              entries.set(headword.id, request.result as StoredEntry);
            }
          };
          request.onerror = () => {
            db.close();
            reject(databaseError("read dictionary definitions", request.error));
          };
        });

        tx.oncomplete = () => {
          db.close();
          resolve(formatHydratedHeadwords(rankedHeadwords, (id) => entries.get(id) ?? null));
        };
        tx.onerror = () => {
          db.close();
          reject(databaseError("read dictionary definitions", tx.error));
        };
        tx.onabort = () => {
          db.close();
          reject(databaseError("read dictionary definitions", tx.error));
        };
      }),
  );
}

function searchPersistedEntries(query: string, limit: number): Promise<DictionaryWordResult[]> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const ranked: RankedEntry[] = [];
        const tx = db.transaction(INDEX_STORE, "readonly");
        const request = tx.objectStore(INDEX_STORE).openCursor();

        request.onerror = () => {
          db.close();
          reject(databaseError("search the saved dictionary", request.error));
        };
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            return;
          }

          addRankedEntry(ranked, cursor.value as StoredEntry, query, limit);
          cursor.continue();
        };
        tx.oncomplete = () => {
          db.close();
          resolve(formatRankedEntries(ranked));
        };
        tx.onerror = () => {
          db.close();
          reject(databaseError("search the saved dictionary", tx.error));
        };
        tx.onabort = () => {
          db.close();
          reject(databaseError("search the saved dictionary", tx.error));
        };
      }),
  );
}

function searchPersistedHeadwords(query: string, limit: number): Promise<RankedHeadword[]> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const ranked: RankedHeadword[] = [];
        const tx = db.transaction(HEADWORD_STORE, "readonly");
        const request = tx.objectStore(HEADWORD_STORE).openCursor();

        request.onerror = () => {
          db.close();
          reject(databaseError("search the saved dictionary", request.error));
        };
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            return;
          }

          addRankedHeadwordEntry(ranked, cursor.value as StoredHeadword, query, limit);
          cursor.continue();
        };
        tx.oncomplete = () => {
          db.close();
          resolve(ranked);
        };
        tx.onerror = () => {
          db.close();
          reject(databaseError("search the saved dictionary", tx.error));
        };
        tx.onabort = () => {
          db.close();
          reject(databaseError("search the saved dictionary", tx.error));
        };
      }),
  );
}

function rankEntries(entries: StoredEntry[], query: string, limit: number): DictionaryWordResult[] {
  const ranked: RankedEntry[] = [];
  entries.forEach((entry) => addRankedEntry(ranked, entry, query, limit));
  return formatRankedEntries(ranked);
}

function rankHeadwordEntries(entries: StoredEntry[], query: string, limit: number): DictionaryWordResult[] {
  const ranked: RankedHeadword[] = [];
  entries.forEach((entry) => addRankedHeadwordEntry(ranked, entryToHeadword(entry), query, limit));
  return formatRankedHeadwords(ranked);
}

function rankHeadwords(headwords: StoredHeadword[], query: string, limit: number): RankedHeadword[] {
  const ranked: RankedHeadword[] = [];
  headwords.forEach((headword) => addRankedHeadwordEntry(ranked, headword, query, limit));
  return ranked;
}

function addRankedEntry(ranked: RankedEntry[], entry: StoredEntry, query: string, limit: number): void {
  const rank = rankEntry(entry, query);
  if (rank.score <= 0) {
    return;
  }

  ranked.push({ entry, rank });
  ranked.sort(compareRankedEntries);
  if (ranked.length > limit) {
    ranked.length = limit;
  }
}

function addRankedHeadwordEntry(ranked: RankedHeadword[], headword: StoredHeadword, query: string, limit: number): void {
  const rank = rankHeadwordEntry(headword, query);
  if (rank.score <= 0) {
    return;
  }

  ranked.push({ headword, rank });
  ranked.sort(compareRankedHeadwords);
  if (ranked.length > limit) {
    ranked.length = limit;
  }
}

function compareRankedEntries(a: RankedEntry, b: RankedEntry): number {
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

function formatRankedEntries(ranked: RankedEntry[]): DictionaryWordResult[] {
  return ranked.map(({ entry, rank }) => ({
    id: entry.id,
    term: entry.term,
    reading: entry.reading,
    senseGroups: entry.senseGroups,
    termScore: entry.termScore,
    score: rank.score,
    source: "jitendex" as const,
  }));
}

function formatRankedHeadwords(ranked: RankedHeadword[]): DictionaryWordResult[] {
  return ranked.map(({ headword, rank }) => ({
    id: headword.id,
    term: headword.term,
    reading: headword.reading,
    senseGroups: [],
    termScore: headword.termScore,
    score: rank.score,
    source: "jitendex" as const,
  }));
}

function formatHydratedHeadwords(ranked: RankedHeadword[], findEntry: (id: string) => StoredEntry | null): DictionaryWordResult[] {
  return ranked.flatMap(({ headword, rank }) => {
    const entry = findEntry(headword.id);
    if (!entry) {
      return [];
    }
    return [{
      id: entry.id,
      term: entry.term,
      reading: entry.reading,
      senseGroups: entry.senseGroups,
      termScore: entry.termScore,
      score: rank.score,
      source: "jitendex" as const,
    }];
  });
}

function entryToHeadword(entry: StoredEntry): StoredHeadword {
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

function databaseError(action: string, error: DOMException | null): Error {
  if (error?.name === "UnknownError") {
    return new Error(`Could not ${action}. The browser reported an IndexedDB storage error. Clear the local dictionary and upload the Jitendex zip again.`);
  }
  if (error?.message) {
    return new Error(`Could not ${action}: ${error.message}`);
  }
  return new Error(`Could not ${action}.`);
}

function mergeYomitanRow(groupedEntries: Map<string, StoredEntry>, row: YomitanTerm, fallbackId: string, importOrder: number): void {
  const [term, reading, definitionTags, , termScore, glossary] = row;
  const cleanReading = reading || term;
  const id = stableWordId(term, cleanReading, fallbackId);
  const senseGroups = parseJitendexGlossary(glossary, id);
  if (!term || senseGroups.length === 0) {
    return;
  }

  const existing = groupedEntries.get(id) ?? {
    id,
    term,
    reading: cleanReading,
    senseGroups: [],
    termScore,
    priorityRank: priorityRank(definitionTags, termScore),
    importOrder,
    searchable: "",
  };

  existing.termScore = Math.max(existing.termScore, termScore);
  existing.priorityRank = Math.max(existing.priorityRank, priorityRank(definitionTags, termScore));
  existing.importOrder = Math.min(existing.importOrder, importOrder);
  senseGroups.forEach((senseGroup) => {
    const signature = senseGroupSignature(senseGroup);
    if (existing.senseGroups.some((item) => senseGroupSignature(item) === signature)) {
      return;
    }
    const groupIndex = existing.senseGroups.length;
    existing.senseGroups.push({
      ...senseGroup,
      id: `${id}:group:${groupIndex}`,
      senses: senseGroup.senses.map((sense, senseIndex) => ({
        ...sense,
        id: `${id}:group:${groupIndex}:sense:${senseIndex}`,
        index: totalSenseCount(existing.senseGroups) + senseIndex,
      })),
    });
  });

  existing.searchable = buildSearchableText(existing);
  groupedEntries.set(id, existing);
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
  const ranked = entries
    .map((entry) => ({
      entry: {
        id: stableWordId(entry.term, entry.reading, entry.term),
        term: entry.term,
        reading: entry.reading,
        senseGroups: [],
        termScore: entry.termScore,
        priorityRank: priorityRank(entry.definitionTags, entry.termScore),
        importOrder: entry.importOrder,
        searchable: normalize(`${entry.term} ${entry.reading}`),
      },
      rank: rankEntry(
        {
          id: stableWordId(entry.term, entry.reading, entry.term),
          term: entry.term,
          reading: entry.reading,
          senseGroups: [],
          termScore: entry.termScore,
          priorityRank: priorityRank(entry.definitionTags, entry.termScore),
          importOrder: entry.importOrder,
          searchable: normalize(`${entry.term} ${entry.reading}`),
        },
        normalizedQuery,
      ),
    }))
    .filter((item) => item.rank.score > 0)
    .sort(compareRankedEntries);
  return ranked.map(({ entry }) => ({ term: entry.term, reading: entry.reading }));
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

  return {
    id: groupId,
    tags,
    partOfSpeech,
    verbTypes,
    misc,
    senses,
  };
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
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNodesByKind(item, kind));
  }
  if (!isRecord(value)) {
    return [];
  }

  const matches = structuredContentKind(value) === kind ? [value] : [];
  return [...matches, ...collectNodesByKind(value.content, kind)];
}

function collectNodesByTag(value: unknown, tag: string): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNodesByTag(item, tag));
  }
  if (!isRecord(value)) {
    return [];
  }

  const matches = value.tag === tag ? [value] : [];
  return [...matches, ...collectNodesByTag(value.content, tag)];
}

function collectListItemTexts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectListItemTexts);
  }
  if (!isRecord(value)) {
    return typeof value === "string" ? [cleanExtractedText(value)] : [];
  }
  if (value.tag === "li") {
    return [textFromNode(value)].filter(Boolean);
  }
  return collectListItemTexts(value.content);
}

function directChildren(node: Record<string, unknown>): Array<Record<string, unknown>> {
  const content = node.content;
  if (Array.isArray(content)) {
    return content.filter(isRecord);
  }
  return isRecord(content) ? [content] : [];
}

function textFromNode(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return cleanExtractedText(value.map(textFromNode).join(""));
  }
  if (!isRecord(value)) {
    return "";
  }
  if (structuredContentKind(value) === "attribution-footnote") {
    return "";
  }
  if (value.tag === "rt" || value.tag === "rp" || value.tag === "img") {
    return "";
  }
  if (typeof value.text === "string") {
    return cleanExtractedText(value.text);
  }
  return textFromNode(value.content);
}

function structuredContentKind(value: Record<string, unknown>): string {
  const data = isRecord(value.data) ? value.data : {};
  const rawKind = data["sc-content"] ?? data.scContent ?? data.content ?? data.type ?? value.type ?? "";
  return typeof rawKind === "string" ? rawKind : "";
}

function buildSearchableText(entry: StoredEntry): string {
  const parts = entry.senseGroups.flatMap((group) => [
    ...group.tags.flatMap((tag) => [tag.code, tag.label, tag.title]),
    ...group.senses.flatMap((sense) => [
      ...sense.glosses,
      ...sense.notes,
      ...sense.xrefs.flatMap((xref) => [xref.label, xref.target]),
      ...sense.examples.flatMap((example) => [example.japanese, example.english]),
    ]),
  ]);
  return normalize(`${entry.term} ${entry.reading} ${parts.join(" ")}`);
}

function totalSenseCount(groups: DictionarySenseGroup[]): number {
  return groups.reduce((total, group) => total + group.senses.length, 0);
}

function senseGroupSignature(group: DictionarySenseGroup): string {
  return JSON.stringify({
    tags: group.tags.map((tag) => tag.code),
    senses: group.senses.map((sense) => sense.glosses),
  });
}

function uniqueTags(tags: DictionaryTag[]): DictionaryTag[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = `${tag.category}:${tag.code}:${tag.label}`;
    if (seen.has(key)) {
      return false;
    }
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
    if (seen.has(key)) {
      return false;
    }
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

function priorityRank(definitionTags: string, termScore: number): number {
  if (/priority/i.test(definitionTags)) return 4;
  if (definitionTags.includes("★")) return 3;
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

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}
