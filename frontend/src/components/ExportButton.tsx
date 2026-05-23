interface ExportButtonProps {
  onClick: () => void;
}

export function ExportButton({ onClick }: ExportButtonProps) {
  return (
    <aside className="order-first lg:order-none lg:sticky lg:top-5" aria-label="Export actions">
      <button className="relative grid min-h-24 w-full place-content-center gap-1 rounded-xl border border-pink-300/30 bg-pink-500 px-5 py-4 text-center text-white shadow-2xl shadow-pink-950/35 transition hover:-translate-y-0.5 hover:bg-pink-400 lg:min-h-32" onClick={onClick}>
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">Export</span>
        <strong className="text-xl leading-tight">Send to Anki</strong>
      </button>
    </aside>
  );
}
