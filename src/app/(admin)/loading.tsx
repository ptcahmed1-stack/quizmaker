export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/60" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
