export interface DictionaryTag {
  code: string;
  label: string;
  title: string;
  category: "partOfSpeech" | "misc";
}

export interface DictionaryExample {
  japanese: string;
  english: string;
}

export interface DictionaryXref {
  label: string;
  target: string;
}

export interface DictionarySense {
  id: string;
  glosses: string[];
  examples: DictionaryExample[];
  notes: string[];
  xrefs: DictionaryXref[];
  index: number;
}

export interface DictionarySenseGroup {
  id: string;
  tags: DictionaryTag[];
  partOfSpeech: DictionaryTag[];
  verbTypes: DictionaryTag[];
  misc: DictionaryTag[];
  senses: DictionarySense[];
}

export interface DictionaryWordResult {
  id: string;
  term: string;
  reading: string;
  senseGroups: DictionarySenseGroup[];
  termScore: number;
  score: number;
  source: "jitendex";
}

export interface DictionaryMetadata {
  version: string;
  sourceUrl: string;
  attribution: string;
  indexedAt: string;
  entryCount: number;
}

export interface StoredEntry {
  id: string;
  term: string;
  reading: string;
  senseGroups: DictionarySenseGroup[];
  termScore: number;
  priorityRank: number;
  importOrder: number;
  searchable: string;
}

export interface StoredHeadword {
  id: string;
  term: string;
  reading: string;
  termScore: number;
  priorityRank: number;
  importOrder: number;
  searchable: string;
}

export type YomitanTerm = [string, string, string, string, number, unknown[], number, string?];
