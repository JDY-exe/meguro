import assert from "node:assert/strict";
import test from "node:test";
import { hydrateEntries, searchHeadwords } from "./ranking.js";
import type { StoredEntry, StoredHeadword } from "./types.js";

test("headword search prioritizes exact and prefix matches before includes and fuzzy matches", () => {
  const headwords: StoredHeadword[] = [
    headword("幾", "いく", 200, 1),
    headword("行く", "いく", 200, 2, 4),
    headword("生きる", "いきる", 180, 3),
    headword("思い出す", "おもいだす", 100, 4),
  ];

  const results = searchHeadwords(headwords, "いく", 4);

  assert.deepEqual(results.map((result) => result.term), ["行く", "幾"]);
  assert.equal(results[0].senseGroups.length, 0);
});

test("entry hydration preserves requested id order and skips missing ids", () => {
  const entries = new Map<string, StoredEntry>([
    ["a", entry("a", "行く", "いく")],
    ["b", entry("b", "幾", "いく")],
  ]);

  const results = hydrateEntries(["b", "missing", "a"], entries);

  assert.deepEqual(results.map((result) => result.id), ["b", "a"]);
  assert.deepEqual(results[0].senseGroups[0].senses[0].glosses, ["how many"]);
});

function headword(term: string, reading: string, termScore: number, importOrder: number, priorityRank = 0): StoredHeadword {
  return {
    id: `${term}:${reading}`,
    term,
    reading,
    termScore,
    priorityRank,
    importOrder,
    searchable: `${term}${reading}`,
  };
}

function entry(id: string, term: string, reading: string): StoredEntry {
  return {
    id,
    term,
    reading,
    termScore: 0,
    priorityRank: 0,
    importOrder: 0,
    searchable: `${term}${reading}`,
    senseGroups: [{
      id: `${id}:group:0`,
      tags: [],
      partOfSpeech: [],
      verbTypes: [],
      misc: [],
      senses: [{
        id: `${id}:sense:0`,
        glosses: [term === "幾" ? "how many" : "to go"],
        examples: [],
        notes: [],
        xrefs: [],
        index: 0,
      }],
    }],
  };
}
