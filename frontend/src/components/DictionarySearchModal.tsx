import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import type { DictionarySense, DictionarySenseGroup, DictionarySenseSelection, DictionaryWordResult } from "../types/cards";
import { eyebrowClass, headingClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./uiClasses";

type SelectionScope = "word" | "senses" | null;
const DEFINITION_PREVIEW_LIMIT = 2;

interface DictionarySearchModalProps {
  error: string | null;
  isLoading: boolean;
  query: string;
  results: DictionaryWordResult[];
  onClose: () => void;
  onManualDefinition: (word: DictionaryWordResult | null, query: string) => void;
  onSearch: (query: string) => void;
  onUseDefinitions: (word: DictionaryWordResult, selections: DictionarySenseSelection[]) => void;
}

export function DictionarySearchModal({
  error,
  isLoading,
  query,
  results,
  onClose,
  onManualDefinition,
  onSearch,
  onUseDefinitions,
}: DictionarySearchModalProps) {
  const [searchQuery, setSearchQuery] = useState(query);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const [hoveredSenseId, setHoveredSenseId] = useState<string | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [selectedSenseIds, setSelectedSenseIds] = useState<string[]>([]);
  const [selectionScope, setSelectionScope] = useState<SelectionScope>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [expandedWordIds, setExpandedWordIds] = useState<string[]>([]);
  const [pendingScrollWordId, setPendingScrollWordId] = useState<string | null>(null);
  const [pendingRestoreScrollTop, setPendingRestoreScrollTop] = useState<number | null>(null);
  const resultPaneRef = useRef<HTMLDivElement | null>(null);
  const expandToggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const preExpansionScrollTops = useRef(new Map<string, number>());

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    const searchTimer = window.setTimeout(() => {
      onSearch(searchQuery);
    }, 180);
    return () => window.clearTimeout(searchTimer);
  }, [onSearch, searchQuery]);

  useEffect(() => {
    setHoveredWordId(null);
    setHoveredSenseId(null);
    setSelectedWordId(null);
    setSelectedSenseIds([]);
    setSelectionScope(null);
    setExpandedWordIds([]);
    setPendingScrollWordId(null);
    setPendingRestoreScrollTop(null);
    preExpansionScrollTops.current.clear();
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsShiftPressed(false);
      }
    };
    const clearShiftPressed = () => setIsShiftPressed(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearShiftPressed);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearShiftPressed);
    };
  }, []);

  useEffect(() => {
    if (!pendingScrollWordId || !expandedWordIds.includes(pendingScrollWordId)) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      scrollExpansionToggleIntoView(pendingScrollWordId);
      setPendingScrollWordId(null);
    }, 0);
    return () => window.clearTimeout(scrollTimer);
  }, [expandedWordIds, pendingScrollWordId]);

  useEffect(() => {
    if (pendingRestoreScrollTop === null) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      resultPaneRef.current?.scrollTo({
        top: pendingRestoreScrollTop,
        behavior: "smooth",
      });
      setPendingRestoreScrollTop(null);
    }, 0);
    return () => window.clearTimeout(scrollTimer);
  }, [expandedWordIds, pendingRestoreScrollTop]);

  const selectedWord = useMemo(() => results.find((result) => result.id === selectedWordId) ?? null, [results, selectedWordId]);
  const selectedSelections = useMemo(
    () => {
      if (!selectedWord) {
        return [];
      }
      if (selectionScope === "word") {
        return selectedWord.senseGroups.flatMap((group) => group.senses.map((sense) => ({ group, sense })));
      }
      return selectedWord.senseGroups.flatMap((group) =>
        group.senses.filter((sense) => selectedSenseIds.includes(sense.id)).map((sense) => ({ group, sense })),
      );
    },
    [selectedSenseIds, selectedWord, selectionScope],
  );
  const manualWord = selectedWord ?? results[0] ?? null;

  const selectWord = (word: DictionaryWordResult) => {
    setSelectedWordId(word.id);
    setSelectedSenseIds([]);
    setSelectionScope("word");
  };

  const toggleSense = (word: DictionaryWordResult, sense: DictionarySense, shiftKey: boolean) => {
    const isSameSenseSelection = selectedWordId === word.id && selectionScope === "senses";
    setSelectedWordId(word.id);
    setSelectionScope("senses");
    setSelectedSenseIds((currentSenseIds) => {
      if (!isSameSenseSelection || !shiftKey) {
        return [sense.id];
      }
      return currentSenseIds.includes(sense.id)
        ? currentSenseIds.filter((id) => id !== sense.id)
        : [...currentSenseIds, sense.id];
    });
  };

  const toggleWordExpansion = (wordId: string) => {
    const willExpand = !expandedWordIds.includes(wordId);
    if (willExpand) {
      preExpansionScrollTops.current.set(wordId, resultPaneRef.current?.scrollTop ?? 0);
      setPendingScrollWordId(wordId);
    } else {
      setPendingRestoreScrollTop(preExpansionScrollTops.current.get(wordId) ?? 0);
      preExpansionScrollTops.current.delete(wordId);
    }
    setExpandedWordIds((currentWordIds) =>
      currentWordIds.includes(wordId)
        ? currentWordIds.filter((id) => id !== wordId)
        : [...currentWordIds, wordId],
    );
  };

  const scrollExpansionToggleIntoView = (wordId: string) => {
    const resultPane = resultPaneRef.current;
    const toggle = expandToggleRefs.current.get(wordId);
    if (!resultPane || !toggle) {
      return;
    }

    window.requestAnimationFrame(() => {
      const resultPaneRect = resultPane.getBoundingClientRect();
      const toggleRect = toggle.getBoundingClientRect();
      resultPane.scrollTo({
        top: resultPane.scrollTop + toggleRect.bottom - resultPaneRect.bottom,
        behavior: "smooth",
      });
    });
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      role="presentation"
      transition={{ duration: 0.16, ease: "easeOut" }}
      onMouseDown={onClose}
    >
      <motion.section
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="grid h-[88vh] max-h-[88vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 rounded-2xl border border-stone-700 bg-stone-900 p-5 shadow-2xl shadow-black/50"
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        initial={{ opacity: 0, scale: 0.98, y: 16 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dictionary-search-title"
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-800 pb-4">
          <div className="min-w-0 flex-1">
            <p className={eyebrowClass}>interactive jisho</p>
            <h2 className={headingClass} id="dictionary-search-title">Dictionary results</h2>
            <div className="mt-3">
              <input
                className={inputClass}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search word or reading"
                aria-label="Search dictionary"
              />
            </div>
          </div>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-700 bg-stone-800 text-stone-200 transition hover:bg-stone-700" aria-label="Close dictionary search" onClick={onClose}>
            <X aria-hidden="true" size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 overflow-auto pr-1" ref={resultPaneRef}>
          {isLoading && results.length === 0 && <DictionarySkeleton />}
          {!isLoading && error && <div className="rounded-xl border border-pink-400/30 bg-pink-500/10 p-4 text-sm text-pink-100">{error}</div>}
          {!isLoading && !error && searchQuery.trim() && results.length === 0 && (
            <div className="rounded-xl border border-stone-700 bg-stone-950/50 p-6 text-center text-sm text-stone-400">No dictionary results found.</div>
          )}
          {!isLoading && !error && !searchQuery.trim() && results.length === 0 && (
            <div className="rounded-xl border border-stone-700 bg-stone-950/50 p-6 text-center text-sm text-stone-400">Start typing to search the local dictionary.</div>
          )}
          {!error && results.length > 0 && (
            <div className="grid gap-3">
              {results.map((word) => {
                const isWordHovered = hoveredWordId === word.id;
                const isWholeWordSelected = selectedWordId === word.id && selectionScope === "word";
                const hasHoveredChild = word.senseGroups.some((group) => group.senses.some((sense) => sense.id === hoveredSenseId));
                const hasSelectedChild = selectedWordId === word.id && selectionScope === "senses";
                const hasActiveChild = hasHoveredChild || hasSelectedChild;
                const definitionCount = word.senseGroups.reduce((count, group) => count + group.senses.length, 0);
                const canExpand = definitionCount > DEFINITION_PREVIEW_LIMIT;
                const isExpanded = expandedWordIds.includes(word.id);
                const visibleSenseGroups = getVisibleSenseGroups(word, isExpanded);
                const wordStateClass = hasHoveredChild
                  ? "border-pink-300/40 bg-stone-950/35"
                  : isWholeWordSelected
                    ? "border-pink-300/40 bg-pink-400/10"
                    : isWordHovered || hasActiveChild
                    ? "border-pink-300/40 bg-stone-950/35"
                    : "border-stone-700 bg-stone-950/35";
                return (
                  <article
                    className={`cursor-pointer rounded-xl border p-4 transition ${wordStateClass}`}
                    key={word.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectWord(word)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectWord(word);
                      }
                    }}
                    onMouseEnter={() => setHoveredWordId(word.id)}
                    onMouseLeave={() => {
                      setHoveredWordId(null);
                      setHoveredSenseId(null);
                    }}
                  >
                    <div className="mb-3">
                      <h3 className="text-2xl font-semibold text-stone-50">
                        <RubyWord term={word.term} reading={word.reading} />
                      </h3>
                    </div>

                    <div className="grid gap-3">
                      {word.senseGroups.length === 0 && isLoading ? (
                        <DefinitionSkeleton />
                      ) : (
                        visibleSenseGroups.map((group) => (
                          <SenseGroupView
                            group={group}
                            hoveredSenseId={hoveredSenseId}
                            isSelectedWord={selectedWordId === word.id && selectionScope === "senses"}
                            key={group.id}
                            selectedSenseIds={selectedSenseIds}
                            word={word}
                            onHoverSense={setHoveredSenseId}
                            onToggleSense={toggleSense}
                          />
                        ))
                      )}
                      {canExpand && (
                        <button
                          className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-stone-50"
                          type="button"
                          aria-expanded={isExpanded}
                          ref={(button) => {
                            if (button) {
                              expandToggleRefs.current.set(word.id, button);
                            } else {
                              expandToggleRefs.current.delete(word.id);
                            }
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleWordExpansion(word.id);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <ChevronRight aria-hidden="true" className={`h-4 w-4 transition ${isExpanded ? "rotate-90" : ""}`} strokeWidth={2.2} />
                          {isExpanded ? "View less" : `View more (${definitionCount - DEFINITION_PREVIEW_LIMIT})`}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isShiftPressed
                ? "border-pink-300/60 bg-pink-500/20 text-pink-50 shadow-sm shadow-pink-500/20"
                : "border-stone-700 bg-stone-950/60 text-stone-300"
            }`}
          >
            {isShiftPressed ? "Selecting multiple" : "Shift-click to select multiple"}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className={`${secondaryButtonClass} w-full sm:w-56`} onClick={() => onManualDefinition(manualWord, searchQuery.trim())} disabled={isLoading || !searchQuery.trim()}>
              Input Manual definition
            </button>
            <button className={`${primaryButtonClass} sm:w-56`} onClick={() => selectedWord && onUseDefinitions(selectedWord, selectedSelections)} disabled={!selectedWord || selectedSelections.length === 0 || isLoading}>
              Use selected definitions
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

interface SenseGroupViewProps {
  group: DictionarySenseGroup;
  hoveredSenseId: string | null;
  isSelectedWord: boolean;
  selectedSenseIds: string[];
  word: DictionaryWordResult;
  onHoverSense: (id: string | null) => void;
  onToggleSense: (word: DictionaryWordResult, sense: DictionarySense, shiftKey: boolean) => void;
}

function SenseGroupView({ group, hoveredSenseId, isSelectedWord, selectedSenseIds, word, onHoverSense, onToggleSense }: SenseGroupViewProps) {
  const metadata = groupMetadata(group);
  return (
    <section className="grid gap-1.5">
      {metadata && <p className="text-sm font-semibold text-stone-300">{metadata}</p>}
      <ol className="grid gap-1.5">
        {group.senses.map((sense) => {
          const isSenseHovered = hoveredSenseId === sense.id;
          const isSelected = isSelectedWord && selectedSenseIds.includes(sense.id);
          return (
            <li key={sense.id}>
              <button
                className={`grid w-full grid-cols-[2rem_1fr] gap-2 rounded-lg p-2.5 text-left transition ${isSelected ? "bg-pink-500/20 text-pink-50 ring-1 ring-pink-300/50" : isSenseHovered ? "bg-stone-800 text-stone-50" : "text-stone-300 hover:bg-stone-800/70"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSense(word, sense, event.shiftKey);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                onMouseEnter={() => onHoverSense(sense.id)}
                onMouseLeave={() => onHoverSense(null)}
              >
                <span className="text-sm font-semibold text-stone-500">{sense.index + 1}</span>
                <span className="grid gap-1.5">
                  <span className="text-base font-semibold leading-6 text-stone-100">{sense.glosses.join("; ")}</span>
                  {sense.notes.length > 0 && <span className="text-sm text-stone-400">{sense.notes.join(" ")}</span>}
                  {sense.examples.map((example, index) => (
                    <span className="grid gap-1 text-sm leading-5" key={`${sense.id}:example:${index}`}>
                      {example.japanese && <span className="text-stone-300">{example.japanese}</span>}
                      {example.english && <span className="text-stone-400">{example.english}</span>}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function groupMetadata(group: DictionarySenseGroup): string {
  return group.tags.map((tag) => tag.title || tag.label).filter(Boolean).join(", ");
}

function RubyWord({ term, reading }: { term: string; reading: string }) {
  const cleanTerm = term.trim();
  const cleanReading = reading.trim();
  if (!cleanTerm || !cleanReading || cleanTerm === cleanReading) {
    return <>{cleanTerm}</>;
  }

  const okurigana = commonKanaSuffix(cleanTerm, cleanReading);
  const base = okurigana ? cleanTerm.slice(0, -okurigana.length) : cleanTerm;
  const rubyReading = okurigana ? cleanReading.slice(0, -okurigana.length) : cleanReading;

  return (
    <>
      <ruby>
        {base}
        <rp>[</rp>
        <rt className="text-sm font-medium text-stone-300">{rubyReading}</rt>
        <rp>]</rp>
      </ruby>
      {okurigana}
    </>
  );
}

function commonKanaSuffix(term: string, reading: string): string {
  const maxLength = Math.min(term.length, reading.length);
  let suffix = "";

  for (let length = 1; length <= maxLength; length += 1) {
    const termSuffix = term.slice(-length);
    if (termSuffix !== reading.slice(-length) || !/^[\u3040-\u30ffー]+$/.test(termSuffix)) {
      break;
    }
    suffix = termSuffix;
  }

  return suffix;
}

function getVisibleSenseGroups(word: DictionaryWordResult, isExpanded: boolean): DictionarySenseGroup[] {
  if (isExpanded) {
    return word.senseGroups;
  }

  let remainingVisibleSenses = DEFINITION_PREVIEW_LIMIT;
  return word.senseGroups.flatMap((group) => {
    if (remainingVisibleSenses <= 0) {
      return [];
    }

    const senses = group.senses.slice(0, remainingVisibleSenses);
    remainingVisibleSenses -= senses.length;
    return senses.length > 0 ? [{ ...group, senses }] : [];
  });
}

function DefinitionSkeleton() {
  return (
    <div className="grid gap-1.5" aria-hidden="true">
      <div className="h-4 w-24 animate-pulse rounded bg-stone-800/80" />
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[2rem_1fr] gap-2 rounded-lg p-2.5">
          <div className="h-4 w-4 animate-pulse rounded bg-stone-800/70" />
          <div className="grid gap-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-stone-800/80" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-stone-800/60" />
          </div>
        </div>
        <div className="grid grid-cols-[2rem_1fr] gap-2 rounded-lg p-2.5">
          <div className="h-4 w-4 animate-pulse rounded bg-stone-800/50" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-stone-800/60" />
        </div>
      </div>
    </div>
  );
}

function DictionarySkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="rounded-xl border border-stone-700 bg-stone-950/35 p-4" key={index}>
          <div className="mb-4 h-7 w-40 animate-pulse rounded bg-stone-800" />
          <div className="grid gap-2">
            <div className="h-10 animate-pulse rounded-lg bg-stone-800/80" />
            <div className="h-10 animate-pulse rounded-lg bg-stone-800/60" />
            <div className="h-10 animate-pulse rounded-lg bg-stone-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
