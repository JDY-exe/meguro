import type { DictionaryExample, DictionarySense, DictionarySenseGroup, DictionaryTag, DictionaryXref } from "./types.js";
import { cleanExtractedText, isRecord } from "./text.js";

export function parseJitendexGlossary(value: unknown, entryId = "entry"): DictionarySenseGroup[] {
  return collectNodesByKind(value, "sense-group")
    .map((node, groupIndex) => parseSenseGroup(node, `${entryId}:group:${groupIndex}`))
    .filter((group) => group.senses.length > 0);
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
