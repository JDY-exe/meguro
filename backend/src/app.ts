import cors from "@fastify/cors";
import Fastify from "fastify";
import { DEFAULT_JITENDEX_URL, downloadAndParseDictionary } from "./indexer.js";
import { hydrateEntries, searchHeadwords } from "./ranking.js";
import { buildRamIndexes, DictionaryStore } from "./store.js";
import type { DictionaryMetadata, StoredEntry, StoredHeadword } from "./types.js";

type LoadState = "loading" | "ready" | "error";

export interface BackendConfig {
  dbPath: string;
  jitendexUrl: string;
  allowReindex: boolean;
}

interface DictionaryRuntime {
  state: LoadState;
  metadata: DictionaryMetadata | null;
  error: string | null;
  headwords: StoredHeadword[];
  entriesById: Map<string, StoredEntry>;
}

export function createBackendConfig(): BackendConfig {
  return {
    dbPath: process.env.DICTIONARY_DB_PATH ?? "./data/jitendex.sqlite",
    jitendexUrl: process.env.JITENDEX_URL ?? DEFAULT_JITENDEX_URL,
    allowReindex: process.env.ALLOW_REINDEX === "true",
  };
}

export async function createApp(config: BackendConfig) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const store = new DictionaryStore(config.dbPath);
  const runtime: DictionaryRuntime = {
    state: "loading",
    metadata: null,
    error: null,
    headwords: [],
    entriesById: new Map(),
  };

  async function loadDictionary(force = false): Promise<void> {
    runtime.state = "loading";
    runtime.error = null;
    try {
      const existingMetadata = force ? null : store.getMetadata();
      const existingEntries = existingMetadata ? store.loadEntries() : [];
      if (existingMetadata && existingEntries.length > 0) {
        const indexes = buildRamIndexes(existingEntries);
        runtime.metadata = existingMetadata;
        runtime.headwords = indexes.headwords;
        runtime.entriesById = indexes.entriesById;
      } else {
        const { entries, metadata } = await downloadAndParseDictionary(config.jitendexUrl);
        store.replaceEntries(entries, metadata);
        const indexes = buildRamIndexes(entries);
        runtime.metadata = metadata;
        runtime.headwords = indexes.headwords;
        runtime.entriesById = indexes.entriesById;
      }
      runtime.state = "ready";
    } catch (error) {
      runtime.state = "error";
      runtime.error = error instanceof Error ? error.message : String(error);
      app.log.error(error);
    }
  }

  const readyPromise = loadDictionary();

  app.get("/api/dictionary/status", async () => ({
    state: runtime.state,
    metadata: runtime.metadata,
    error: runtime.error,
    entryCount: runtime.entriesById.size,
  }));

  app.get<{ Querystring: { q?: string; limit?: string } }>("/api/dictionary/headwords", async (request, reply) => {
    if (runtime.state !== "ready") {
      return reply.code(503).send({ error: runtime.error ?? "Dictionary is still loading." });
    }
    const limit = clampLimit(Number(request.query.limit ?? 8));
    return searchHeadwords(runtime.headwords, request.query.q ?? "", limit);
  });

  app.post<{ Body: { ids?: unknown } }>("/api/dictionary/entries", async (request, reply) => {
    if (runtime.state !== "ready") {
      return reply.code(503).send({ error: runtime.error ?? "Dictionary is still loading." });
    }
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((id): id is string => typeof id === "string") : [];
    return hydrateEntries(ids.slice(0, 50), runtime.entriesById);
  });

  app.post("/api/dictionary/reindex", async (_request, reply) => {
    if (!config.allowReindex) {
      return reply.code(404).send({ error: "Reindex endpoint is disabled." });
    }
    void loadDictionary(true);
    return { state: "loading" };
  });

  app.addHook("onClose", async () => store.close());

  return { app, readyPromise };
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 8;
  return Math.min(Math.max(Math.floor(limit), 1), 50);
}
