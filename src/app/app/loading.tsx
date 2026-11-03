/** Okamžitá odezva při přechodu mezi moduly, než dorazí data. */
export default function Loading() {
  return (
    <div className="flex max-w-6xl animate-pulse flex-col gap-6 px-6 py-8 sm:px-10 lg:py-10" aria-busy="true" aria-label="Načítám">
      <div className="h-10 w-64 rounded-xl bg-line/60" />
      <div className="h-4 w-96 max-w-full rounded-lg bg-line/50" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-surface shadow-card ring-1 ring-line/70" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-surface shadow-card ring-1 ring-line/70" />
        ))}
      </div>
    </div>
  );
}
