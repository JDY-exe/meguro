import type { AnkiFields } from "../types/cards";
import { eyebrowClass, headingClass, panelClass } from "./uiClasses";

interface PayloadPanelProps {
  fields: AnkiFields;
}

export function PayloadPanel({ fields }: PayloadPanelProps) {
  const payloadLines = JSON.stringify(fields, null, 2).split("\n");

  return (
    <section className={`${panelClass} min-w-0`}>
      <p className={eyebrowClass}>payload</p>
      <h2 className={headingClass}>Live fields</h2>
      <pre className="mt-4 grid max-h-[440px] min-w-0 overflow-y-auto rounded-lg bg-stone-950 p-4 text-xs leading-5 text-stone-200">
        {payloadLines.map((line, index) => (
          <span className="block min-w-0 truncate" key={`${index}:${line}`}>
            {line}
          </span>
        ))}
      </pre>
    </section>
  );
}
