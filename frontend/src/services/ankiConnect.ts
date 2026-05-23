import type { AnkiFields } from "../types/cards";
import { REQUIRED_MEGURO_FIELDS } from "./cardBuilder";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;
const MISSING_MODEL_MESSAGE = "Anki note type `meguro` was not found. Create it with the fields listed in anki/meguro/README.md.";

type AnkiAction = "version" | "deckNames" | "createDeck" | "modelNames" | "modelFieldNames" | "addNote";

type AnkiParams = Record<string, unknown> | undefined;

interface AnkiConnectPayload {
  action: AnkiAction;
  version: typeof ANKI_CONNECT_VERSION;
  params?: AnkiParams;
}

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export interface MeguroNoteExport {
  deckName: string;
  fields: AnkiFields;
  tags: string[];
}

export interface AnkiClient {
  version(): Promise<number>;
  deckNames(): Promise<string[]>;
  createDeck(deck: string): Promise<number>;
  modelNames(): Promise<string[]>;
  modelFieldNames(modelName: string): Promise<string[]>;
  addNote(note: MeguroNoteExport): Promise<number>;
}

function payload(action: AnkiAction, params?: AnkiParams): AnkiConnectPayload {
  return params ? { action, version: ANKI_CONNECT_VERSION, params } : { action, version: ANKI_CONNECT_VERSION };
}

async function invoke<T>(action: AnkiAction, params?: AnkiParams): Promise<T> {
  const body = payload(action, params);
  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    throw new Error(`Could not reach AnkiConnect at ${ANKI_CONNECT_URL}. Open Anki, install/enable AnkiConnect, then try again.`);
  }

  if (!response.ok) {
    throw new Error(`AnkiConnect returned HTTP ${response.status}.`);
  }

  const json = (await response.json()) as AnkiConnectResponse<T>;
  if (json.error) {
    throw new Error(json.error);
  }
  if (!("result" in json)) {
    throw new Error("AnkiConnect response did not include a result.");
  }
  return json.result;
}

export function createRealAnkiClient(): AnkiClient {
  return {
    version: () => invoke<number>("version"),
    deckNames: () => invoke<string[]>("deckNames"),
    createDeck: (deck) => invoke<number>("createDeck", { deck }),
    modelNames: () => invoke<string[]>("modelNames"),
    modelFieldNames: (modelName) => invoke<string[]>("modelFieldNames", { modelName }),
    addNote: async (note) => {
      const noteId = await invoke<number | null>("addNote", { note: toAnkiConnectNote(note) });
      if (noteId === null) {
        throw new Error("AnkiConnect could not create this note. It may be a duplicate or the note type/deck may be invalid.");
      }
      return noteId;
    },
  };
}

export function createMockAnkiClient(): AnkiClient {
  const logPayload = <T>(action: AnkiAction, params: AnkiParams, result: T): T => {
    console.info("[meguro mock AnkiConnect] request", payload(action, params));
    console.info("[meguro mock AnkiConnect] response", { result, error: null });
    return result;
  };

  return {
    version: async () => logPayload("version", undefined, ANKI_CONNECT_VERSION),
    deckNames: async () => logPayload("deckNames", undefined, ["meguro::Demo", "Japanese", "Default"]),
    createDeck: async (deck) => logPayload("createDeck", { deck }, Date.now()),
    modelNames: async () => logPayload("modelNames", undefined, ["Basic", "Cloze", "meguro"]),
    modelFieldNames: async (modelName) => logPayload("modelFieldNames", { modelName }, [...REQUIRED_MEGURO_FIELDS]),
    addNote: async (note) => logPayload("addNote", { note: toAnkiConnectNote(note) }, Date.now()),
  };
}

export async function validateAnkiConnection(client: AnkiClient): Promise<number> {
  const version = await client.version();
  if (version < ANKI_CONNECT_VERSION) {
    throw new Error(`AnkiConnect API v${version} is running, but meguro expects v${ANKI_CONNECT_VERSION}. Update AnkiConnect and restart Anki.`);
  }
  return version;
}

export async function validateMeguroModel(client: AnkiClient): Promise<void> {
  const modelNames = await client.modelNames();
  if (!modelNames.includes("meguro")) {
    throw new Error(MISSING_MODEL_MESSAGE);
  }

  const fieldNames = await client.modelFieldNames("meguro");
  const missingFields = REQUIRED_MEGURO_FIELDS.filter((field) => !fieldNames.includes(field));
  if (missingFields.length > 0) {
    throw new Error(`Anki note type \`meguro\` is missing fields: ${missingFields.join(", ")}.`);
  }
}

function toAnkiConnectNote(note: MeguroNoteExport) {
  return {
    deckName: note.deckName,
    modelName: "meguro",
    fields: note.fields,
    tags: ["meguro", ...note.tags.filter(Boolean)],
    options: {
      allowDuplicate: false,
      duplicateScope: "deck",
      duplicateScopeOptions: {
        deckName: note.deckName,
        checkChildren: true,
        checkAllModels: false,
      },
    },
  };
}
