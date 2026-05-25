import JSZip from "jszip";
import type { DictionaryMetadata, StoredEntry, YomitanTerm } from "./types.js";
import { parseJitendexGlossary } from "./parser.js";
import { normalize } from "./text.js";
import { priorityRank } from "./ranking.js";

export const DEFAULT_JITENDEX_URL = "https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip";
export const JITENDEX_ATTRIBUTION = "Jitendex by Stephen Kraus, derived from JMdict and Tatoeba data, licensed under CC BY-SA 4.0.";

export async function downloadAndParseDictionary(sourceUrl: string): Promise<{ entries: StoredEntry[]; metadata: DictionaryMetadata }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Dictionary download failed with HTTP ${response.status}.`);
  }
  const buffer = await response.arrayBuffer();
  return parseDictionaryBuffer(buffer, sourceUrl);
}

export async function parseDictionaryBuffer(buffer: ArrayBuffer, sourceUrl: string): Promise<{ entries: StoredEntry[]; metadata: DictionaryMetadata }> {
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
  for (const file of termFiles) {
    const rows = JSON.parse(await file.async("string")) as YomitanTerm[];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      mergeYomitanRow(groupedEntries, rows[rowIndex], `${file.name}:${rowIndex}`, importOrder);
      importOrder += 1;
    }
  }

  const entries = [...groupedEntries.values()];
  return {
    entries,
    metadata: {
      version,
      sourceUrl,
      attribution: JITENDEX_ATTRIBUTION,
      indexedAt: new Date().toISOString(),
      entryCount: entries.length,
    },
  };
}

function mergeYomitanRow(groupedEntries: Map<string, StoredEntry>, row: YomitanTerm, fallbackId: string, importOrder: number): void {
  const [term, reading, definitionTags, , termScore, glossary] = row;
  const cleanReading = reading || term;
  const id = stableWordId(term, cleanReading, fallbackId);
  const senseGroups = parseJitendexGlossary(glossary, id);
  if (!term || senseGroups.length === 0) return;

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
  for (const senseGroup of senseGroups) {
    const signature = senseGroupSignature(senseGroup);
    if (existing.senseGroups.some((item) => senseGroupSignature(item) === signature)) continue;
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
  }

  existing.searchable = buildSearchableText(existing);
  groupedEntries.set(id, existing);
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

function totalSenseCount(groups: StoredEntry["senseGroups"]): number {
  return groups.reduce((total, group) => total + group.senses.length, 0);
}

function senseGroupSignature(group: StoredEntry["senseGroups"][number]): string {
  return JSON.stringify({
    tags: group.tags.map((tag) => tag.code),
    senses: group.senses.map((sense) => sense.glosses),
  });
}

function stableWordId(term: string, reading: string, fallbackId: string): string {
  const normalizedTerm = normalize(term);
  const normalizedReading = normalize(reading);
  return normalizedTerm || normalizedReading ? `${normalizedTerm}:${normalizedReading}` : fallbackId;
}
