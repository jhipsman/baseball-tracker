/** Lightweight route fallback: no data reads, and no fabricated player/game values. */
export function PageSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className="w-full max-w-5xl space-y-5 py-4">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        {!compact && (
          <div className="space-y-3">
            <div className="h-7 w-44 rounded-md bg-zinc-200" />
            <div className="h-4 w-28 rounded bg-zinc-100" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-zinc-200 bg-surface p-5">
              <div className="h-3 w-16 rounded bg-zinc-100" />
              <div className="mt-4 h-6 w-10 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-surface p-5">
          <div className="mb-5 h-4 w-32 rounded bg-zinc-200" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="my-4 h-4 rounded bg-zinc-100"
              style={{ width: `${85 - i * 15}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
