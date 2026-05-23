import type { DictionaryStatus } from "../types/cards";
import { eyebrowClass, headingClass, inputClass, labelClass, mutedBoxClass, panelClass, secondaryButtonClass, warningBoxClass } from "./uiClasses";

interface DictionaryPanelProps {
  status: DictionaryStatus;
  onResetDictionary: () => void;
  onUploadDictionary: (file: File | null) => void;
}

export function DictionaryPanel({ status, onResetDictionary, onUploadDictionary }: DictionaryPanelProps) {
  return (
    <section className={`${panelClass} grid gap-4`}>
      <p className={eyebrowClass}>dictionary</p>
      <h2 className={headingClass}>Local Jitendex index</h2>
      <DictionaryStatusView status={status} />
      <label className={labelClass}>
        Upload Jitendex Yomitan zip
        <input className={inputClass} type="file" accept=".zip,application/zip" onChange={(event) => onUploadDictionary(event.target.files?.[0] ?? null)} />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
        <a className="inline-flex items-center justify-center rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:-translate-y-0.5 hover:bg-white" href="https://jitendex.org/pages/downloads.html" target="_blank" rel="noreferrer">Get Jitendex zip</a>
        <button className={secondaryButtonClass} onClick={onResetDictionary} disabled={status.state === "downloading"}>Clear local dictionary</button>
      </div>
    </section>
  );
}

function DictionaryStatusView({ status }: { status: DictionaryStatus }) {
  if (status.state === "ready") {
    return (
      <div className="my-3 grid gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100">
        <strong>Ready</strong>
        <span className="text-emerald-200/80">{status.metadata.entryCount.toLocaleString()} indexed entries</span>
        <small className="text-emerald-200/70">{status.metadata.attribution}</small>
      </div>
    );
  }
  if (status.state === "downloading") {
    return <div className={mutedBoxClass}>{status.message}</div>;
  }
  if (status.state === "error") {
    return <div className={warningBoxClass}>{status.message}</div>;
  }
  return <div className={mutedBoxClass}>No dictionary is stored yet. Upload the Jitendex Yomitan zip once and it will load from IndexedDB on later visits.</div>;
}
