// src/app/stats/countries/page.tsx — separate stats view: mapa mundi.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCountryStats } from '@/lib/analytics';
import { Kpi, nf, StatsSkeleton } from '../_components';

const mapLoading = () => (
  <div className="h-[min(70vw,430px)] min-h-56 animate-pulse rounded-xl bg-slate-800" />
);

const CountryMap = dynamic(() => import('@/components/charts/CountryMap'), {
  loading: mapLoading,
});

export default function StatsCountriesPage() {
  return (
    <main className="stats-dashboard min-h-screen bg-slate-900 text-slate-100">
      <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Mapa mundi
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Books around the world
          </h1>
          <p className="mt-1 text-sm text-slate-400 sm:text-base">
            Number of authors and books read per author country. Hover a country
            for details.
          </p>
        </div>
        <nav aria-label="Statistics actions" className="flex flex-wrap gap-2">
          <Link
            href="/stats"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            ← Statistics
          </Link>
        </nav>
      </header>
      {/* Uncached Prisma reads must be Suspense-gated, like the rest of /stats. */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCountriesContent />
      </Suspense>
    </main>
  );
}

async function StatsCountriesContent() {
  const stats = await getCountryStats();
  const totalAuthors = stats.reduce((s, d) => s + d.authors, 0);
  const totalBooks = stats.reduce((s, d) => s + d.books, 0);

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 mb-6">
        <Kpi label="Countries" value={stats.length} tone="emerald" />
        <Kpi label="Authors" value={totalAuthors} tone="blue" />
        <Kpi label="Books" value={nf.format(totalBooks)} tone="sky" />
      </div>
      {stats.length === 0 ? (
        <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-800 p-6 sm:p-8">
          <p className="text-slate-400 text-sm">
            No author nationality data available yet. Run author nationality
            enrichment to see countries on the map.
          </p>
        </section>
      ) : (
        <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-800">
          <CountryMap
            data={stats}
            className="h-[min(70vw,430px)] min-h-56"
          />
        </section>
      )}
    </div>
  );
}
