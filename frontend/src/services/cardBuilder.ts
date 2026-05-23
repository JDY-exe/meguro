import type { AnkiFields, CardEntry } from "../types/cards";

export const MAX_MEGURO_TERMS = 4;
export const MIN_MEGURO_TERMS = 2;

export const REQUIRED_MEGURO_FIELDS = [
  "Term1",
  "Def1",
  "Ex1",
  "Term2",
  "Def2",
  "Ex2",
  "Term3",
  "Def3",
  "Ex3",
  "Term4",
  "Def4",
  "Ex4",
] as const;

export function createEmptyEntry(): CardEntry {
  return {
    id: crypto.randomUUID(),
    term: "",
    reading: "",
    definitionMarkdown: "",
    definitionHtml: "",
    example: "",
    source: "manual",
  };
}

export function formatInlineFurigana(term: string, reading: string): string {
  const cleanTerm = term.trim();
  const cleanReading = reading.trim();
  if (!cleanTerm || !cleanReading || cleanTerm === cleanReading) {
    return cleanTerm;
  }

  const okurigana = commonKanaSuffix(cleanTerm, cleanReading);
  if (okurigana) {
    return `${cleanTerm.slice(0, -okurigana.length)}[${cleanReading.slice(0, -okurigana.length)}]${okurigana}`;
  }

  return `${cleanTerm}[${cleanReading}]`;
}

export function stripInlineFurigana(term: string): string {
  return term.replace(/\[([^\]]*)\]/g, "");
}

function commonKanaSuffix(term: string, reading: string): string {
  const maxLength = Math.min(term.length, reading.length);
  let suffix = "";

  for (let length = 1; length <= maxLength; length += 1) {
    const termSuffix = term.slice(-length);
    if (termSuffix !== reading.slice(-length) || !/^[\u3040-\u30ffー]+$/.test(termSuffix)) {
      break;
    }
    suffix = termSuffix;
  }

  return suffix;
}

export function buildAnkiFields(entries: CardEntry[]): AnkiFields {
  const fields: AnkiFields = {
    Term1: "",
    Def1: "",
    Ex1: "",
    Term2: "",
    Def2: "",
    Ex2: "",
    Term3: "",
    Def3: "",
    Ex3: "",
    Term4: "",
    Def4: "",
    Ex4: "",
  };

  entries.slice(0, MAX_MEGURO_TERMS).forEach((entry, index) => {
    const slot = index + 1;
    fields[`Term${slot}` as keyof AnkiFields] = entry.reading.trim() ? formatInlineFurigana(entry.term, entry.reading) : entry.term.trim();
    fields[`Def${slot}` as keyof AnkiFields] = entry.definitionHtml.trim();
    fields[`Ex${slot}` as keyof AnkiFields] = entry.example.trim();
  });

  return fields;
}

export function validateEntries(entries: CardEntry[]): string[] {
  const usableEntries = entries.filter((entry) => entry.term.trim());
  const errors: string[] = [];

  if (usableEntries.length < MIN_MEGURO_TERMS) {
    errors.push("Add at least 2 terms before exporting.");
  }

  if (usableEntries.length > MAX_MEGURO_TERMS) {
    errors.push("meguro cards currently support at most 4 terms.");
  }

  usableEntries.forEach((entry, index) => {
    if (!entry.definitionHtml.trim()) {
      errors.push(`Term ${index + 1} needs a definition.`);
    }
  });

  return errors;
}
