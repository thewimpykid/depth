export default function Loading() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">

        {/* Hero skeleton */}
        <section className="relative overflow-hidden rounded-[14px] border border-white/8 bg-[#090909] px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
          <div className="relative flex flex-col items-center gap-5">
            <div className="h-[72px] w-40 animate-pulse rounded-[10px] bg-white/[0.05]" />
            <div className="h-4 w-64 animate-pulse rounded-full bg-white/[0.04]" />
            <div className="h-[68px] w-44 animate-pulse rounded-[10px] bg-white/[0.04]" />
            <div className="h-11 w-60 animate-pulse rounded-[10px] bg-white/[0.04]" />
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/22">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/30 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/40" />
              </span>
              warming cache
            </div>
          </div>
        </section>

        {/* Scatter skeleton */}
        <div className="mt-4 h-72 animate-pulse rounded-[12px] border border-white/8 bg-[#090909]" />

        {/* Grid skeleton */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-52 animate-pulse rounded-[12px] border border-white/8 bg-[#090909]" />
          <div className="space-y-4">
            <div className="h-36 animate-pulse rounded-[12px] border border-white/8 bg-[#090909]" />
            <div className="h-36 animate-pulse rounded-[12px] border border-white/8 bg-[#090909]" />
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] tracking-[0.04em] text-white/18">
          First visit fetches live data and warms the cache — subsequent loads are instant.
        </p>

      </div>
    </main>
  );
}
