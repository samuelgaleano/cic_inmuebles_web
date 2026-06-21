export default function LoadingInmuebles() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="mb-8 h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-slate-200" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
