import assert from "node:assert/strict";
import test from "node:test";
import { parseJitendexGlossary } from "./parser.js";

const sc = (content: unknown) => [{ type: "structured-content", content }];
const node = (content: string, inner?: unknown) => ({ tag: "div", data: { content }, content: inner });
const tag = (code: string, label: string, title: string, content = "part-of-speech-info") => ({
  tag: "span",
  title,
  data: { class: "tag", code, content },
  content: label,
});
const glossary = (...items: string[]) => ({ tag: "ul", data: { content: "glossary" }, content: items.map((content) => ({ tag: "li", content })) });

test("parses Jitendex sense groups, tags, glosses, examples, and xrefs", () => {
  const groups = parseJitendexGlossary(
    sc(node("sense-group", [
      tag("v5k-s", "5-dan", "Godan verb - Iku/Yuku special class"),
      tag("vi", "intransitive", "intransitive verb"),
      node("sense", [
        glossary("to go", "to move"),
        node("example-sentence", [
          node("example-sentence-a", { tag: "span", lang: "ja", content: ["行って"] }),
          node("example-sentence-b", { tag: "span", lang: "en", content: ["go"] }),
        ]),
        node("xref", node("xref-content", [{ tag: "span", data: { content: "reference-label" }, content: "See also" }, { tag: "a", content: "来る" }])),
      ]),
    ])),
    "iku",
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].partOfSpeech.map((item) => item.code), ["v5k-s", "vi"]);
  assert.deepEqual(groups[0].senses[0].glosses, ["to go", "to move"]);
  assert.deepEqual(groups[0].senses[0].examples[0], { japanese: "行って", english: "go" });
  assert.deepEqual(groups[0].senses[0].xrefs, [{ label: "See also", target: "来る" }]);
});

test("ignores redirect-only glossary entries", () => {
  assert.deepEqual(parseJitendexGlossary(sc(node("redirect-glossary", ["->", { tag: "a", content: "吹っ切れる" }]))), []);
});
