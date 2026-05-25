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

test("renders a dictionary sense group with metadata, number, and glosses", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ["to go", "to move (towards)"])]),
    '<div class="meguro-dict-definition"><section class="meguro-dict-group"><div class="meguro-dict-tags">Godan verb - Iku/Yuku special class</div><ol class="meguro-dict-list"><li class="meguro-dict-gloss" value="1">to go; to move (towards)</li></ol></section></div>',
  );
});

test("groups consecutive dictionary senses with matching metadata", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ["to go"]), selection(2, ["to pass"])]),
    '<div class="meguro-dict-definition"><section class="meguro-dict-group"><div class="meguro-dict-tags">Godan verb - Iku/Yuku special class</div><ol class="meguro-dict-list"><li class="meguro-dict-gloss" value="1">to go</li><li class="meguro-dict-gloss" value="3">to pass</li></ol></section></div>',
  );
});

test("starts a new dictionary group when metadata changes", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ["to go"]), selection(1, ["to come"], "Kuru verb - special class")])
      .match(/<section class="meguro-dict-group">/g)
      ?.length,
    2,
  );
});

test("escapes dictionary tags and glosses", () => {
  assert.equal(
    dictionarySelectionsToHtml([selection(0, ['to "mark" <script>'], "verb & auxiliary")]),
    '<div class="meguro-dict-definition"><section class="meguro-dict-group"><div class="meguro-dict-tags">verb &amp; auxiliary</div><ol class="meguro-dict-list"><li class="meguro-dict-gloss" value="1">to &quot;mark&quot; &lt;script&gt;</li></ol></section></div>',
  );
});

test("keeps manual markdown lists basic", () => {
  assert.equal(markdownToSafeHtml("- to stop\n- to fasten"), "<ul><li>to stop</li><li>to fasten</li></ul>");
});

test("keeps manual markdown paragraphs basic", () => {
  assert.equal(markdownToSafeHtml("to stop\nto fasten"), "<p>to stop</p><p>to fasten</p>");
});
