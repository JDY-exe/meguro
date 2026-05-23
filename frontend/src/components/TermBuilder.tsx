import { MAX_MEGURO_TERMS } from "../services/cardBuilder";
import type { CardEntry } from "../types/cards";
import { eyebrowClass, headingClass, inputClass, labelClass, panelClass, secondaryButtonClass } from "./uiClasses";

const MULTILINE_DEFINITION_PLACEHOLDER = ` - to stop\n - to fasten`;

interface TermBuilderProps {
  entries: CardEntry[];
  isDictionaryReady: boolean;
  onAddEntry: () => void;
  onChangeDefinition: (id: string, definitionMarkdown: string) => void;
  onRemoveEntry: (id: string) => void;
  onSearchDictionary: (entryId: string) => void;
  onUpdateEntry: (id: string, patch: Partial<CardEntry>) => void;
}

export function TermBuilder({
  entries,
  isDictionaryReady,
  onAddEntry,
  onChangeDefinition,
  onRemoveEntry,
  onSearchDictionary,
  onUpdateEntry,
}: TermBuilderProps) {
  return (
    <div className={panelClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={eyebrowClass}>terms</p>
          <h2 className={headingClass}>Comparison set</h2>
        </div>
        <button className={secondaryButtonClass} onClick={onAddEntry} disabled={entries.length >= MAX_MEGURO_TERMS}>Add term</button>
      </div>

      <div className="mt-5 grid gap-4">
        {entries.map((entry, index) => (
          <TermCard
            entry={entry}
            index={index}
            isDictionaryReady={isDictionaryReady}
            key={entry.id}
            totalEntries={entries.length}
            onChangeDefinition={onChangeDefinition}
            onRemoveEntry={onRemoveEntry}
            onSearchDictionary={onSearchDictionary}
            onUpdateEntry={onUpdateEntry}
          />
        ))}
      </div>
    </div>
  );
}

interface TermCardProps {
  entry: CardEntry;
  index: number;
  isDictionaryReady: boolean;
  totalEntries: number;
  onChangeDefinition: (id: string, definitionMarkdown: string) => void;
  onRemoveEntry: (id: string) => void;
  onSearchDictionary: (entryId: string) => void;
  onUpdateEntry: (id: string, patch: Partial<CardEntry>) => void;
}

function TermCard({
  entry,
  index,
  isDictionaryReady,
  totalEntries,
  onChangeDefinition,
  onRemoveEntry,
  onSearchDictionary,
  onUpdateEntry,
}: TermCardProps) {
  return (
    <article className="relative grid gap-4 rounded-xl border border-stone-700/80 bg-stone-950/35 p-4">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-stone-400">
        <span>Term {index + 1}</span>
        <span className={`rounded-full px-2 py-1 text-[0.7rem] ${entry.source === "jitendex" ? "bg-emerald-400/10 text-emerald-200" : "bg-stone-800 text-stone-300"}`}>{entry.source}</span>
        <button className="rounded-md px-2 py-1 text-xs font-semibold text-pink-300 transition hover:bg-pink-400/10 disabled:opacity-45" onClick={() => onRemoveEntry(entry.id)} disabled={totalEntries <= 2}>Remove</button>
      </div>

      <label className={labelClass}>
        Term (ruby notation supported)
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className={inputClass}
            value={entry.term}
            onChange={(event) => onUpdateEntry(entry.id, { term: event.target.value, reading: "", source: "manual" })}
            placeholder="留[と]める"
          />
          <button className={`${secondaryButtonClass} whitespace-nowrap`} onClick={() => onSearchDictionary(entry.id)} disabled={!isDictionaryReady} type="button">
            Search dictionary
          </button>
        </div>
      </label>

      <label className={labelClass}>
        Definition (markdown supported)
        <textarea
          className={inputClass}
          value={entry.definitionMarkdown}
          onChange={(event) => onChangeDefinition(entry.id, event.target.value)}
          placeholder={MULTILINE_DEFINITION_PLACEHOLDER}
          rows={4}
        />
      </label>

      <label className={labelClass}>
        Example sentence
        <input
          className={inputClass}
          value={entry.example}
          onChange={(event) => onUpdateEntry(entry.id, { example: event.target.value, source: "manual" })}
          placeholder="ここで車を留める。"
        />
      </label>
    </article>
  );
}
