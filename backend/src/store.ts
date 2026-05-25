import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DictionaryMetadata, StoredEntry, StoredHeadword } from "./types.js";
import { entryToHeadword } from "./ranking.js";

interface MetadataRow {
  key: string;
  value: string;
}

interface EntryRow {
  id: string;
  term: string;
  reading: string;
  termScore: number;
  priorityRank: number;
  importOrder: number;
  searchable: string;
  senseGroups: string;
}

export class DictionaryStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        term TEXT NOT NULL,
        reading TEXT NOT NULL,
        termScore INTEGER NOT NULL,
        priorityRank INTEGER NOT NULL,
        importOrder INTEGER NOT NULL,
        searchable TEXT NOT NULL,
        senseGroups TEXT NOT NULL
      );
    `);
  }

  getMetadata(): DictionaryMetadata | null {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get("jitendex") as Pick<MetadataRow, "value"> | undefined;
    return row ? JSON.parse(row.value) as DictionaryMetadata : null;
  }

  loadEntries(): StoredEntry[] {
    const rows = this.db.prepare("SELECT * FROM entries ORDER BY importOrder ASC").all() as unknown as EntryRow[];
    return rows.map((row) => ({
      id: row.id,
      term: row.term,
      reading: row.reading,
      termScore: row.termScore,
      priorityRank: row.priorityRank,
      importOrder: row.importOrder,
      searchable: row.searchable,
      senseGroups: JSON.parse(row.senseGroups),
    }));
  }

  replaceEntries(entries: StoredEntry[], metadata: DictionaryMetadata): void {
    this.db.exec("BEGIN");
    try {
      this.db.exec("DELETE FROM metadata; DELETE FROM entries;");
      const insertEntry = this.db.prepare(`
        INSERT INTO entries (id, term, reading, termScore, priorityRank, importOrder, searchable, senseGroups)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of entries) {
        insertEntry.run(entry.id, entry.term, entry.reading, entry.termScore, entry.priorityRank, entry.importOrder, entry.searchable, JSON.stringify(entry.senseGroups));
      }
      this.db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("jitendex", JSON.stringify(metadata));
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

export function buildRamIndexes(entries: StoredEntry[]): { headwords: StoredHeadword[]; entriesById: Map<string, StoredEntry> } {
  return {
    headwords: entries.map(entryToHeadword),
    entriesById: new Map(entries.map((entry) => [entry.id, entry])),
  };
}
