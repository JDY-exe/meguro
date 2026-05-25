import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { eyebrowClass, headingClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass, warningBoxClass } from "./uiClasses";

interface ExportModalProps {
  ankiMessage: string;
  decks: string[];
  isExporting: boolean;
  isLoadingDecks: boolean;
  selectedDeck: string;
  validationErrors: string[];
  onClose: () => void;
  onExport: () => void;
  onRefreshDecks: () => void;
  onSelectedDeckChange: (deck: string) => void;
}

export function ExportModal({
  ankiMessage,
  decks,
  isExporting,
  isLoadingDecks,
  selectedDeck,
  validationErrors,
  onClose,
  onExport,
  onRefreshDecks,
  onSelectedDeckChange,
}: ExportModalProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={onClose}>
      <section className="grid w-full max-w-md gap-4 rounded-xl border border-stone-700 bg-stone-900 p-5 shadow-2xl shadow-black/45" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={eyebrowClass}>export</p>
            <h2 className={headingClass} id="export-title">AnkiConnect</h2>
          </div>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-700 bg-stone-800 text-stone-200 transition hover:bg-stone-700" aria-label="Close export modal" onClick={onClose}>x</button>
        </div>
        <DeckCombobox decks={decks} isLoadingDecks={isLoadingDecks} selectedDeck={selectedDeck} onSelectedDeckChange={onSelectedDeckChange} />
        <button className={secondaryButtonClass} onClick={onRefreshDecks} disabled={isLoadingDecks || isExporting}>
          {isLoadingDecks ? "Checking AnkiConnect..." : "Refresh decks"}
        </button>
        {validationErrors.length > 0 && <div className={warningBoxClass}>{validationErrors.join(" ")}</div>}
        <button className={primaryButtonClass} onClick={onExport} disabled={isExporting || validationErrors.length > 0 || !selectedDeck.trim()}>
          {isExporting ? "Exporting..." : "Export to Anki"}
        </button>
        <p className="text-sm leading-6 text-stone-400">{ankiMessage}</p>
      </section>
    </div>
  );
}

interface DeckComboboxProps {
  decks: string[];
  isLoadingDecks: boolean;
  selectedDeck: string;
  onSelectedDeckChange: (deck: string) => void;
}

function DeckCombobox({ decks, isLoadingDecks, selectedDeck, onSelectedDeckChange }: DeckComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const listboxId = "anki-deck-options";
  const normalizedSelection = selectedDeck.trim().toLocaleLowerCase();
  const matchingDecks = useMemo(() => {
    const query = selectedDeck.trim().toLocaleLowerCase();
    const sortedDecks = [...decks].sort((a, b) => a.localeCompare(b));

    if (!query) {
      return sortedDecks;
    }

    return sortedDecks.filter((deck) => deck.toLocaleLowerCase().includes(query));
  }, [decks, selectedDeck]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [selectedDeck, decks]);

  const chooseDeck = (deck: string) => {
    onSelectedDeckChange(deck);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(matchingDecks.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && matchingDecks[activeIndex]) {
      event.preventDefault();
      chooseDeck(matchingDecks[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <label className={labelClass}>
      Target deck
      <div className="relative" ref={comboboxRef}>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          className={`${inputClass} pr-11`}
          onChange={(event) => {
            onSelectedDeckChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="meguro::Japanese"
          role="combobox"
          value={selectedDeck}
        />
        <button
          aria-label={isOpen ? "Close deck list" : "Open deck list"}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-800 hover:text-stone-100"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-stone-700 bg-stone-950 shadow-2xl shadow-black/45">
            <div className="max-h-56 overflow-y-auto py-1" id={listboxId} role="listbox">
              {isLoadingDecks && <div className="px-3 py-2.5 text-sm text-stone-400">Checking AnkiConnect...</div>}
              {!isLoadingDecks && matchingDecks.length === 0 && <div className="px-3 py-2.5 text-sm text-stone-400">{selectedDeck.trim() ? "Press export to create this deck." : "No decks loaded."}</div>}
              {!isLoadingDecks &&
                matchingDecks.map((deck, index) => {
                  const isSelected = deck.toLocaleLowerCase() === normalizedSelection;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition ${
                        isActive ? "bg-pink-500/14 text-stone-50" : "text-stone-200 hover:bg-stone-800/80"
                      }`}
                      key={deck}
                      onClick={() => chooseDeck(deck)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="min-w-0 truncate">{deck}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-pink-300" aria-hidden="true" />}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}
