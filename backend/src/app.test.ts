import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app.js";
import { DictionaryStore } from "./store.js";
import type { DictionaryMetadata, StoredEntry } from "./types.js";

test("serves headwords and hydrates requested entries from SQLite-backed RAM indexes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "meguro-dict-"));
  const dbPath = join(dir, "jitendex.sqlite");
  const store = new DictionaryStore(dbPath);
  store.replaceEntries([entry("行く:いく", "行く", "いく"), entry("幾:いく", "幾", "いく")], metadata());
  store.close();

  const { app, readyPromise } = await createApp({ dbPath, jitendexUrl: "http://unused.invalid/jitendex.zip", allowReindex: false });
  await readyPromise;

  const headwords = await app.inject({ method: "GET", url: "/api/dictionary/headwords?q=%E3%81%84%E3%81%8F&limit=2" });
  assert.equal(headwords.statusCode, 200);
  const headwordPayload = JSON.parse(headwords.payload) as Array<{ id: string; senseGroups: unknown[] }>;
  assert.deepEqual(headwordPayload.map((item) => item.id), ["行く:いく", "幾:いく"]);
  assert.equal(headwordPayload[0].senseGroups.length, 0);

  const entries = await app.inject({
    method: "POST",
    url: "/api/dictionary/entries",
    payload: { ids: ["幾:いく", "行く:いく"] },
  });
  assert.equal(entries.statusCode, 200);
  const entryPayload = JSON.parse(entries.payload) as Array<{ id: string; senseGroups: unknown[] }>;
  assert.deepEqual(entryPayload.map((item) => item.id), ["幾:いく", "行く:いく"]);
  assert.equal(entryPayload[0].senseGroups.length, 1);

  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function metadata(): DictionaryMetadata {
  return {
    version: "test",
    sourceUrl: "fixture",
    attribution: "fixture",
    indexedAt: new Date(0).toISOString(),
    entryCount: 2,
  };
}

function entry(id: string, term: string, reading: string): StoredEntry {
  return {
    id,
    term,
    reading,
    termScore: 100,
    priorityRank: term === "行く" ? 4 : 0,
    importOrder: term === "行く" ? 0 : 1,
    searchable: `${term}${reading}`,
    senseGroups: [{
      id: `${id}:group:0`,
      tags: [],
      partOfSpeech: [],
      verbTypes: [],
      misc: [],
      senses: [{
        id: `${id}:sense:0`,
        glosses: [term === "行く" ? "to go" : "how many"],
        examples: [],
        notes: [],
        xrefs: [],
        index: 0,
      }],
    }],
  };
}
