export default function LoadingInmuebles() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-surface" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-line" />
      </div>
      <div className="mb-8 h-40 animate-pulse rounded-[1.4rem] bg-surface" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[1.4rem] border border-line bg-white p-1.5">
            <div className="aspect-[4/3] animate-pulse rounded-[1.05rem] bg-line" />
            <div className="space-y-3 px-3 pb-3 pt-3">
              <div className="h-3 w-20 animate-pulse rounded bg-surface" />
              <div className="h-5 w-full animate-pulse rounded bg-line" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
              <div className="h-6 w-32 animate-pulse rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
