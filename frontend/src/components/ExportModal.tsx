import { eyebrowClass, headingClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass, warningBoxClass } from "./uiClasses";

interface ExportModalProps {
  ankiMessage: string;
  decks: string[];
  isExporting: boolean;
  isLoadingDecks: boolean;
  mockMode: boolean;
  selectedDeck: string;
  validationErrors: string[];
  onClose: () => void;
  onExport: () => void;
  onRefreshDecks: () => void;
  onSelectedDeckChange: (deck: string) => void;
  onSetMockMode: (mockMode: boolean) => void;
}

export function ExportModal({
  ankiMessage,
  decks,
  isExporting,
  isLoadingDecks,
  mockMode,
  selectedDeck,
  validationErrors,
  onClose,
  onExport,
  onRefreshDecks,
  onSelectedDeckChange,
  onSetMockMode,
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
        <label className="flex items-center gap-3 text-sm font-medium text-stone-200">
          <input type="checkbox" checked={mockMode} onChange={(event) => onSetMockMode(event.target.checked)} />
          Mock calls in console
        </label>
        <label className={labelClass}>
          Target deck
          <input
            className={inputClass}
            list="anki-decks"
            value={selectedDeck}
            onChange={(event) => onSelectedDeckChange(event.target.value)}
            placeholder="meguro::Japanese"
          />
          <datalist id="anki-decks">
            {decks.map((deck) => <option key={deck} value={deck} />)}
          </datalist>
        </label>
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
