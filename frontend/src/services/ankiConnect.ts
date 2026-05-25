import type { AnkiFields } from "../types/cards";
import { REQUIRED_MEGURO_FIELDS } from "./cardBuilder";

const DEFAULT_ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_URL = import.meta.env.VITE_ANKI_CONNECT_URL?.trim() || DEFAULT_ANKI_CONNECT_URL;
const ANKI_CONNECT_VERSION = 6;
const MISSING_MODEL_MESSAGE = "Anki note type `meguro` was not found. Create it with the fields listed in anki/meguro/README.md.";

type AnkiAction = "requestPermission" | "version" | "deckNames" | "createDeck" | "modelNames" | "modelFieldNames" | "addNote";

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

interface AnkiPermissionResult {
  permission: "granted" | "denied";
  requireApiKey?: boolean;
  version?: number;
}

export interface MeguroNoteExport {
  deckName: string;
  fields: AnkiFields;
  tags: string[];
}

export interface AnkiClient {
  requestPermission(): Promise<AnkiPermissionResult>;
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
      mode: "cors",
      cache: "default",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    throw new Error(`Could not reach AnkiConnect at ${ANKI_CONNECT_URL} from ${currentOrigin()}. Open Anki, install/enable AnkiConnect, then try again.`);
  }

  if (!response.ok) {
    throw new Error(`AnkiConnect returned HTTP ${response.status} for ${currentOrigin()}. Add this exact origin to AnkiConnect's webCorsOriginList, then restart Anki.`);
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
    requestPermission: () => invoke<AnkiPermissionResult>("requestPermission"),
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
    requestPermission: async () => logPayload("requestPermission", undefined, { permission: "granted", requireApiKey: false, version: ANKI_CONNECT_VERSION }),
    version: async () => logPayload("version", undefined, ANKI_CONNECT_VERSION),
    deckNames: async () => logPayload("deckNames", undefined, ["meguro::Demo", "Japanese", "Default"]),
    createDeck: async (deck) => logPayload("createDeck", { deck }, Date.now()),
    modelNames: async () => logPayload("modelNames", undefined, ["Basic", "Cloze", "meguro"]),
    modelFieldNames: async (modelName) => logPayload("modelFieldNames", { modelName }, [...REQUIRED_MEGURO_FIELDS]),
    addNote: async (note) => logPayload("addNote", { note: toAnkiConnectNote(note) }, Date.now()),
  };
}

export async function validateAnkiConnection(client: AnkiClient): Promise<number> {
  const permission = await client.requestPermission();
  if (permission.permission !== "granted") {
    throw new Error(`AnkiConnect denied permission for ${currentOrigin()}. Approve the Anki popup or add this exact origin to webCorsOriginList, then restart Anki.`);
  }
  if (permission.requireApiKey) {
    throw new Error("AnkiConnect requires an API key, but meguro is not configured with one.");
  }

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

function currentOrigin(): string {
  return typeof window === "undefined" ? "this environment" : window.location.origin;
}
