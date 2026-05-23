import test from "node:test";
import assert from "node:assert/strict";
import { parseJitendexGlossary, __testRankDictionaryEntries } from "./dictionary.js";

const sc = (content: unknown) => [{ type: "structured-content", content }];
const node = (content: string, inner?: unknown) => ({ tag: "div", data: { content }, content: inner });
const tag = (code: string, label: string, title: string, content = "part-of-speech-info") => ({
  tag: "span",
  title,
  data: { class: "tag", code, content },
  content: label,
});
const glossary = (...items: string[]) => ({ tag: "ul", data: { content: "glossary" }, content: items.map((content) => ({ tag: "li", content })) });

test("parses a Jitendex verb entry into sense groups, senses, examples, and xrefs", () => {
  const groups = parseJitendexGlossary(
    sc({
      tag: "ul",
      data: { content: "sense-groups" },
      content: {
        tag: "li",
        data: { content: "sense-group" },
        content: [
          tag("v5k-s", "5-dan (spec.)", "Godan verb - Iku/Yuku special class"),
          tag("vi", "intransitive", "intransitive verb"),
          {
            tag: "ol",
            content: [
              {
                tag: "li",
                data: { content: "sense" },
                content: [
                  glossary("to go", "to move (towards)", "to head (towards)", "to leave (for)"),
                  node("example-sentence", [
                    node("example-sentence-a", { tag: "span", lang: "ja", content: ["お母さん、泳ぎに", { tag: "span", data: { content: "example-keyword" }, content: "行って" }, "もいい？"] }),
                    node("example-sentence-b", { tag: "span", lang: "en", content: ["Can I go swimming, Mother?", { tag: "span", data: { content: "attribution-footnote" }, content: "[1]" }] }),
                  ]),
                  node("xref", node("xref-content", [{ tag: "span", data: { content: "reference-label" }, content: "See also" }, { tag: "a", content: "来る" }])),
                ],
              },
              {
                tag: "li",
                data: { content: "sense" },
                content: glossary("to move through", "to travel across", "to walk along (e.g. a road)"),
              },
            ],
          },
        ],
      },
    }),
    "iku",
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].partOfSpeech.map((item) => item.code), ["v5k-s", "vi"]);
  assert.equal(groups[0].verbTypes[0].title, "Godan verb - Iku/Yuku special class");
  assert.deepEqual(groups[0].senses[0].glosses, ["to go", "to move (towards)", "to head (towards)", "to leave (for)"]);
  assert.equal(groups[0].senses[0].examples[0].japanese, "お母さん、泳ぎに行ってもいい？");
  assert.equal(groups[0].senses[0].examples[0].english, "Can I go swimming, Mother?");
  assert.deepEqual(groups[0].senses[0].xrefs, [{ label: "See also", target: "来る" }]);
});

test("parses simple noun and adjective metadata without leaking labels into glosses", () => {
  const groups = parseJitendexGlossary(
    sc(node("sense-group", [tag("adj-na", "na-adj", "adjectival nouns or quasi-adjectives (keiyodoshi)"), tag("n", "noun", "noun (common) (futsuumeishi)"), tag("uk", "kana", "word usually written using kana alone", "misc-info"), node("sense", glossary("noncommittal", "equivocal", "indecisive"))])),
    "simple",
  );

  assert.deepEqual(groups[0].misc.map((item) => item.code), ["uk"]);
  assert.deepEqual(groups[0].senses[0].glosses, ["noncommittal", "equivocal", "indecisive"]);
});

test("keeps similar definitions grouped inside one sense", () => {
  const groups = parseJitendexGlossary(sc(node("sense-group", [tag("int", "interjection", "interjection (kandoushi)"), node("sense", glossary("heigh-ho", "heave-ho"))])), "dokko");

  assert.equal(groups[0].senses.length, 1);
  assert.deepEqual(groups[0].senses[0].glosses, ["heigh-ho", "heave-ho"]);
});

test("ignores redirect-only entries", () => {
  const groups = parseJitendexGlossary(sc(node("redirect-glossary", ["->", { tag: "a", content: "吹っ切れる" }])), "redirect");

  assert.deepEqual(groups, []);
});

test("does not leak forms or attribution into sense glosses", () => {
  const groups = parseJitendexGlossary(
    sc([
      node("sense-group", [tag("adj-i", "adjective", "adjective (keiyoushi)"), node("sense", glossary("impudent", "brazen"))]),
      node("forms", ["forms", { tag: "table", content: "rarely used form" }]),
      node("attribution", "JMdict | Tatoeba"),
    ]),
    "forms",
  );

  assert.deepEqual(groups[0].senses[0].glosses, ["impudent", "brazen"]);
});

test("prioritizes Jitendex priority forms when reading and score tie", () => {
  const results = __testRankDictionaryEntries(
    [
      { term: "幾", reading: "いく", termScore: 200, definitionTags: "★", importOrder: 1 },
      { term: "行く", reading: "いく", termScore: 200, definitionTags: "★ priority form", importOrder: 2 },
      { term: "畏懼", reading: "いく", termScore: 0, definitionTags: "", importOrder: 0 },
    ],
    "いく",
  );

  assert.deepEqual(results.map((result) => result.term), ["行く", "幾", "畏懼"]);
});
