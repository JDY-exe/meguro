import { eyebrowClass } from "./uiClasses";

export function AppHeader() {
  return (
    <header className="mb-5 flex items-center justify-between">
      <div>
        <p className={eyebrowClass}>meguro card maker</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-50">Comparison cards</h1>
      </div>
    </header>
  );
}
