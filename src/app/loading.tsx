export default function Loading(): JSX.Element {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas" aria-label="Loading NexaChat">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4 shadow-card">
        <span className="h-8 w-8 animate-pulse rounded-xl bg-brand-500" />
        <span className="space-y-2">
          <span className="block h-2.5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="block h-2 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        </span>
      </div>
    </main>
  );
}
