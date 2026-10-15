// src/app/stats/page.tsx
import Link from 'next/link';
import { Suspense } from 'react';
import { PRE_TAB_READING_YEAR_SENTINEL } from '@/lib/ingestion/workbook-parser';
import {
  getDiscoveryMetrics, getGenreShares, getMonthlyPace,
  getRatingDistribution, getTopAuthors, getYearKpis, getYearlyTrend,
} from '@/lib/analytics';
import { Kpi, nf, StatsSkeleton, SuggestionsList, TopAuthorsBooks, TopList } from './_components';
import YearTrendChart from '@/components/charts/YearTrendChart';
import RatingChart from '@/components/charts/RatingChart';
import GenreChart from '@/components/charts/GenreChart';
import AuthorsChart from '@/components/charts/AuthorsChart';
import MonthlyPaceChart from '@/components/charts/MonthlyPaceChart';

// PageProps<'/stats'> is a Next.js-generated global helper (no import needed).
type StatsSearchParams = PageProps<'/stats'>['searchParams'];

export default function StatsPage(props: PageProps<'/stats'>) {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Reading statistics</h1>
          <p className="text-slate-400 mt-1">Trends, rankings and graphs over the whole ledger.</p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
        >
          ← Dashboard
        </Link>
      </header>
      {/* cacheComponents: runtime searchParams + uncached Prisma reads must be Suspense-gated. */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsContent({ searchParams }: { searchParams: StatsSearchParams }) {
  const { year: rawYear } = await searchParams;

  const trend = await getYearlyTrend();
  const availableYears = trend.map((p) => p.readingYear);
  const requested = typeof rawYear === 'string' ? Number(rawYear) : NaN;

  // Invalid or missing ?year= falls back to the newest reading year.
  const year = availableYears.includes(requested)
    ? requested
    : (availableYears[availableYears.length - 1] ?? PRE_TAB_READING_YEAR_SENTINEL);

  const [kpis, ratings, genres, authors, pace, discovery] = await Promise.all([
    getYearKpis(year),
    getRatingDistribution(),
    getGenreShares(),
    getTopAuthors(10),
    getMonthlyPace(year),
    getDiscoveryMetrics(),
  ]);

  return (
    <div className="space-y-10">
      {/* Year pills — URL state, not client state: plain Links keep everything server-rendered. */}
      <nav className="flex flex-wrap gap-2" aria-label="Reading year">
        {availableYears.map((y) => (
          <Link
            key={y}
            href={`/stats?year=${y}`}
            className={`px-3 py-1 rounded-full text-sm font-semibold border transition ${
              y === year
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {y === PRE_TAB_READING_YEAR_SENTINEL ? 'pre-2008' : y}
          </Link>
        ))}
      </nav>

      {/* KPI row — plain server HTML, zero client JS. */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Books completed" value={kpis.booksCompleted} tone="emerald" />
        <Kpi label="Pages read" value={nf.format(kpis.pagesRead)} tone="blue" />
        <Kpi label="Avg pages / book" value={kpis.avgPagesPerBook} tone="amber" />
        <Kpi label="Avg pages / day" value={kpis.avgPagesPerDay} tone="purple" />
        <Kpi label="Avg rating" value={kpis.avgRating === null ? '—' : kpis.avgRating.toFixed(1)} tone="rose" />
        <Kpi label="Active reads" value={kpis.activeReads} tone="sky" />
      </section>

      {/* Graphs — the only client components on the page. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2"><YearTrendChart data={trend} /></div>
        <RatingChart data={ratings} />
        <GenreChart data={genres} />
        <MonthlyPaceChart data={pace.points} withoutDates={pace.withoutDates} />
        <AuthorsChart data={authors} />
      </section>

      {/* Rankings + recommender — server-rendered lists (CONTEXT.md §4). */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TopAuthorsBooks authors={discovery.topAuthors} booksByAuthor={discovery.topAuthorBooks} />
        <TopList
          title="Top 5 genres"
          items={discovery.topGenres.map((g, i) => ({ id: String(i), label: g.genre ?? 'Sin género', value: `${g.books} books` }))}
        />
        <SuggestionsList items={discovery.suggestions} />
      </section>
    </div>
  );
}
