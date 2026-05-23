export type CardEntrySource = "manual" | "jitendex";

export interface CardEntry {
  id: string;
  term: string;
  reading: string;
  definitionMarkdown: string;
  definitionHtml: string;
  example: string;
  source: CardEntrySource;
}

export interface AnkiFields {
  Term1: string;
  Def1: string;
  Ex1: string;
  Term2: string;
  Def2: string;
  Ex2: string;
  Term3: string;
  Def3: string;
  Ex3: string;
  Term4: string;
  Def4: string;
  Ex4: string;
}

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

export interface DictionarySenseSelection {
  group: DictionarySenseGroup;
  sense: DictionarySense;
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

export type DictionaryStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; metadata: DictionaryMetadata }
  | { state: "downloading"; message: string }
  | { state: "error"; message: string };
