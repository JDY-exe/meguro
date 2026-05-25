import test from "node:test";
import assert from "node:assert/strict";
import { dictionarySelectionsToHtml, markdownToSafeHtml } from "./markdown.js";
import type { DictionarySenseSelection } from "../types/cards.js";

function selection(index: number, glosses: string[], tagTitle = "Godan verb - Iku/Yuku special class"): DictionarySenseSelection {
  return {
    group: {
      id: `group-${index}`,
      tags: [{ code: "v5k-s", label: "Godan", title: tagTitle, category: "partOfSpeech" }],
      partOfSpeech: [],
      verbTypes: [],
      misc: [],
      senses: [],
    },
    sense: {
      id: `sense-${index}`,
      glosses,
      examples: [],
      notes: [],
      xrefs: [],
      index,
    },
  };
}

test("renders a dictionary sense with metadata, number, and glosses", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ["to go", "to move (towards)"])]),
    '<div class="meguro-dict-definition"><section class="meguro-dict-sense"><div class="meguro-dict-number">1</div><div class="meguro-dict-body"><div class="meguro-dict-tags">Godan verb - Iku/Yuku special class</div><div class="meguro-dict-gloss">to go; to move (towards)</div></div></section></div>',
  );
});

test("renders multiple dictionary senses with stable source numbering", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ["to go"]), selection(2, ["to pass"])])
      .match(/meguro-dict-number">[0-9]+/g)
      ?.join(","),
    'meguro-dict-number">1,meguro-dict-number">3',
  );
});

test("escapes dictionary tags and glosses", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ['to "mark" <script>'], "verb & auxiliary")]),
    '<div class="meguro-dict-definition"><section class="meguro-dict-sense"><div class="meguro-dict-number">1</div><div class="meguro-dict-body"><div class="meguro-dict-tags">verb &amp; auxiliary</div><div class="meguro-dict-gloss">to &quot;mark&quot; &lt;script&gt;</div></div></section></div>',
  );
});

test("keeps manual markdown lists basic", () => {
  assert.equal(markdownToSafeHtml("- to stop\n- to fasten"), "<ul><li>to stop</li><li>to fasten</li></ul>");
});

test("keeps manual markdown paragraphs basic", () => {
  assert.equal(markdownToSafeHtml("to stop\nto fasten"), "<p>to stop</p><p>to fasten</p>");
});
