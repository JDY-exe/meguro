import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AppHeader } from "./components/AppHeader";
// import { DictionaryPanel } from "./components/DictionaryPanel";
import { DictionarySearchModal } from "./components/DictionarySearchModal";
import { ExportButton } from "./components/ExportButton";
import { ExportModal } from "./components/ExportModal";
import { PayloadPanel } from "./components/PayloadPanel";
import { TermBuilder } from "./components/TermBuilder";
import type { AnkiClient } from "./services/ankiConnect";
import { createRealAnkiClient, validateAnkiConnection, validateMeguroModel } from "./services/ankiConnect";
import { buildAnkiFields, createEmptyEntry, formatInlineFurigana, MAX_MEGURO_TERMS, stripInlineFurigana, validateEntries } from "./services/cardBuilder";
import { getDictionaryStatus, hydrateDictionaryEntries, reindexDictionary, searchDictionaryHeadwords } from "./services/dictionary";
import { dictionarySelectionsToHtml, markdownToSafeHtml } from "./services/markdown";
import type { CardEntry, DictionarySenseSelection, DictionaryStatus, DictionaryWordResult } from "./types/cards";
import "./styles.css";

function App() {
  const [entries, setEntries] = useState<CardEntry[]>([createEmptyEntry(), createEmptyEntry()]);
  const [dictionaryStatus, setDictionaryStatus] = useState<DictionaryStatus>({ state: "idle" });
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState("meguro::Demo");
  const [ankiMessage, setAnkiMessage] = useState("Real AnkiConnect mode is on. Anki must be running with AnkiConnect enabled.");
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dictionaryModalEntryId, setDictionaryModalEntryId] = useState<string | null>(null);
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionaryResults, setDictionaryResults] = useState<DictionaryWordResult[]>([]);
  const [dictionarySearchError, setDictionarySearchError] = useState<string | null>(null);
  const [isSearchingDictionary, setIsSearchingDictionary] = useState(false);
  const dictionarySearchRequestId = useRef(0);
  // const allowDictionaryReindex = import.meta.env.VITE_ALLOW_DICTIONARY_REINDEX === "true";

  const usableEntries = useMemo(() => entries.filter((entry) => entry.term.trim()), [entries]);
  const fields = useMemo(() => buildAnkiFields(usableEntries), [usableEntries]);
  const validationErrors = useMemo(() => validateEntries(usableEntries), [usableEntries]);
  const ankiClient = useMemo<AnkiClient>(() => createRealAnkiClient(), []);

  // Temporarily disable frontend Jitendex status/reindex work while this screen is payload-only.
  // useEffect(() => {
  //   void refreshDictionaryStatus();
  // }, []);
  //
  // useEffect(() => {
  //   if (dictionaryStatus.state !== "loading" && dictionaryStatus.state !== "downloading") {
  //     return;
  //   }
  //   const statusTimer = window.setInterval(() => void refreshDictionaryStatus(), 1500);
  //   return () => window.clearInterval(statusTimer);
  // }, [dictionaryStatus.state]);

  useEffect(() => {
    localStorage.removeItem("meguro:mock-anki");
    setAnkiMessage("Real AnkiConnect mode is on. Anki must be running with AnkiConnect enabled.");
    void loadAnkiDecks();
  }, [ankiClient]);

  const loadAnkiDecks = async () => {
    try {
      setIsLoadingDecks(true);
      const version = await validateAnkiConnection(ankiClient);
      const deckNames = await ankiClient.deckNames();
      setDecks(deckNames);
      setSelectedDeck((current) => (current.trim() ? current : deckNames[0] ?? ""));
      setAnkiMessage(`AnkiConnect v${version} ready. Loaded ${deckNames.length} deck${deckNames.length === 1 ? "" : "s"}.`);
    } catch (error: unknown) {
      setDecks([]);
      setAnkiMessage(errorMessage(error));
    } finally {
      setIsLoadingDecks(false);
    }
  };

  const updateEntry = (id: string, patch: Partial<CardEntry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const updateDefinition = (id: string, definitionMarkdown: string) => {
    updateEntry(id, {
      definitionMarkdown,
      definitionHtml: markdownToSafeHtml(definitionMarkdown),
      source: "manual",
    });
  };

  const addEntry = () => {
    setEntries((current) => (current.length >= MAX_MEGURO_TERMS ? current : [...current, createEmptyEntry()]));
  };

  const removeEntry = (id: string) => {
    setEntries((current) => (current.length <= 2 ? current : current.filter((entry) => entry.id !== id)));
  };

  const refreshDictionaryStatus = async () => {
    try {
      const status = await getDictionaryStatus();
      if (status.state === "ready" && status.metadata) {
        setDictionaryStatus({ state: "ready", metadata: status.metadata });
      } else if (status.state === "loading") {
        setDictionaryStatus({ state: "loading" });
      } else {
        setDictionaryStatus({ state: "error", message: status.error ?? "Dictionary backend is not ready." });
      }
    } catch (error: unknown) {
      setDictionaryStatus({ state: "error", message: errorMessage(error) });
    }
  };

  const resetDictionary = async () => {
    try {
      setDictionaryStatus({ state: "downloading", message: "Reindexing Jitendex on the backend..." });
      await reindexDictionary();
      window.setTimeout(() => void refreshDictionaryStatus(), 800);
    } catch (error: unknown) {
      setDictionaryStatus({ state: "error", message: errorMessage(error) });
    }
  };

  const searchDictionaryForEntry = async (entryId: string, rawQuery: string) => {
    const query = stripInlineFurigana(rawQuery).trim();
    const requestId = dictionarySearchRequestId.current + 1;
    dictionarySearchRequestId.current = requestId;
    if (dictionaryStatus.state !== "ready") {
      return;
    }

    setDictionaryModalEntryId(entryId);
    setDictionaryQuery(query);
    setDictionaryResults([]);
    setDictionarySearchError(null);
    updateEntry(entryId, { term: query, reading: "", source: "manual" });
    if (!query) {
      setIsSearchingDictionary(false);
      return;
    }

    try {
      setIsSearchingDictionary(true);
      const headwords = await searchDictionaryHeadwords(query);
      if (dictionarySearchRequestId.current !== requestId) {
        return;
      }
      setDictionaryResults(headwords);

      await sleep(220);
      if (dictionarySearchRequestId.current !== requestId) {
        return;
      }
      const results = await hydrateDictionaryEntries(headwords.map((headword) => headword.id));
      if (dictionarySearchRequestId.current !== requestId) {
        return;
      }
      setDictionaryResults(mergeHydratedResults(headwords, results));
    } catch (error: unknown) {
      if (dictionarySearchRequestId.current === requestId) {
        setDictionarySearchError(errorMessage(error));
      }
    } finally {
      if (dictionarySearchRequestId.current === requestId) {
        setIsSearchingDictionary(false);
      }
    }
  };

  const openDictionarySearch = (entryId: string) => {
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry || dictionaryStatus.state !== "ready") {
      return;
    }
    const query = stripInlineFurigana(entry.term).trim();
    setDictionaryModalEntryId(entryId);
    setDictionaryQuery(query);
    setDictionaryResults([]);
    setDictionarySearchError(null);
    setIsSearchingDictionary(false);
  };

  const closeDictionarySearch = () => {
    setDictionaryModalEntryId(null);
    setDictionaryQuery("");
    setDictionaryResults([]);
    setDictionarySearchError(null);
    setIsSearchingDictionary(false);
  };

  const searchOpenDictionaryEntry = useCallback(
    (query: string) => {
      if (dictionaryModalEntryId) {
        void searchDictionaryForEntry(dictionaryModalEntryId, query);
      }
    },
    [dictionaryModalEntryId, dictionaryStatus.state],
  );

  const applyDictionaryDefinitions = (word: DictionaryWordResult, selections: DictionarySenseSelection[]) => {
    if (!dictionaryModalEntryId || selections.length === 0) {
      return;
    }
    const definitionHtml = dictionarySelectionsToHtml(selections);
    const example = selections.flatMap((selection) => selection.sense.examples).find((candidate) => candidate.japanese)?.japanese ?? "";
    updateEntry(dictionaryModalEntryId, {
      term: formatInlineFurigana(word.term, word.reading),
      reading: "",
      definitionMarkdown: definitionHtml,
      definitionHtml,
      example,
      source: "jitendex",
    });
    closeDictionarySearch();
  };

  const applyManualDictionaryTerm = (word: DictionaryWordResult | null, query: string) => {
    if (!dictionaryModalEntryId) {
      return;
    }
    if (!word) {
      updateEntry(dictionaryModalEntryId, {
        term: query.trim(),
        reading: "",
        source: "manual",
      });
      closeDictionarySearch();
      return;
    }
    updateEntry(dictionaryModalEntryId, {
      term: formatInlineFurigana(word.term, word.reading),
      reading: "",
      example: firstExample(word),
      source: "jitendex",
    });
    closeDictionarySearch();
  };

  const exportToAnki = async () => {
    const errors = validateEntries(usableEntries);
    if (errors.length > 0) {
      setAnkiMessage(errors.join(" "));
      return;
    }
    const deckName = selectedDeck.trim();
    if (!deckName) {
      setAnkiMessage("Choose or enter a target deck before exporting.");
      return;
    }

    try {
      setIsExporting(true);
      setAnkiMessage("Checking AnkiConnect...");
      await validateAnkiConnection(ankiClient);
      setAnkiMessage("Validating meguro note type...");
      await validateMeguroModel(ankiClient);
      if (!decks.includes(deckName)) {
        setAnkiMessage(`Creating deck ${deckName}...`);
        await ankiClient.createDeck(deckName);
        setDecks((current) => (current.includes(deckName) ? current : [...current, deckName].sort((a, b) => a.localeCompare(b))));
      }
      setAnkiMessage("Sending note to AnkiConnect...");
      const noteId = await ankiClient.addNote({ deckName, fields, tags: [] });
      setSelectedDeck(deckName);
      setAnkiMessage(`Exported note ${noteId}.`);
    } catch (error: unknown) {
      setAnkiMessage(errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
      <AppHeader />

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(150px,0.28fr)]">
        <aside className="grid min-w-0 gap-5 lg:sticky lg:top-5 lg:max-w-[340px]">
          {/* <DictionaryPanel allowReindex={allowDictionaryReindex} status={dictionaryStatus} onResetDictionary={resetDictionary} /> */}
          <PayloadPanel fields={fields} />
        </aside>

        <TermBuilder
          entries={entries}
          isDictionaryReady={false}
          onAddEntry={addEntry}
          onChangeDefinition={updateDefinition}
          onRemoveEntry={removeEntry}
          onSearchDictionary={openDictionarySearch}
          onUpdateEntry={updateEntry}
        />

        <ExportButton onClick={() => setIsExportModalOpen(true)} />
      </section>

      {isExportModalOpen && (
        <ExportModal
          ankiMessage={ankiMessage}
          decks={decks}
          isExporting={isExporting}
          isLoadingDecks={isLoadingDecks}
          selectedDeck={selectedDeck}
          validationErrors={validationErrors}
          onClose={() => setIsExportModalOpen(false)}
          onExport={exportToAnki}
          onRefreshDecks={loadAnkiDecks}
          onSelectedDeckChange={setSelectedDeck}
        />
      )}

      <AnimatePresence>
        {dictionaryModalEntryId && (
          <DictionarySearchModal
            error={dictionarySearchError}
            isLoading={isSearchingDictionary}
            key="dictionary-search-modal"
            query={dictionaryQuery}
            results={dictionaryResults}
            onClose={closeDictionarySearch}
            onManualDefinition={applyManualDictionaryTerm}
            onSearch={searchOpenDictionaryEntry}
            onUseDefinitions={applyDictionaryDefinitions}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mergeHydratedResults(headwords: DictionaryWordResult[], hydrated: DictionaryWordResult[]): DictionaryWordResult[] {
  const hydratedById = new Map(hydrated.map((word) => [word.id, word]));
  return headwords.map((headword) => {
    const hydratedWord = hydratedById.get(headword.id);
    return hydratedWord ? { ...hydratedWord, score: headword.score } : headword;
  });
}

function firstExample(word: DictionaryWordResult): string {
  return word.senseGroups.flatMap((group) => group.senses).flatMap((sense) => sense.examples).find((candidate) => candidate.japanese)?.japanese ?? "";
}

export default App;
