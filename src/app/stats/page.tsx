// src/app/stats/page.tsx
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { PRE_TAB_READING_YEAR_SENTINEL } from '@/lib/ingestion/workbook-parser';
import {
  getAllTimeKpis, getCumulativeTrend, getDiscoveryMetrics, getMetadataCoverage,
  getMonthlyPace, getMostValuableBooks, getOriginShares, getPublicationEraBuckets,
  getRatingDistribution, getRereads, getSeriesProgress, getTopAuthors,
  getTopAuthorsByPages, getTopAuthorsByRating, getTopSubjects, getYearKpis, getYearlyTrend,
} from '@/lib/analytics';
import { Kpi, nf, StatsSkeleton, SuggestionsList, TopAuthorsBooks, TopList } from './_components';

const YearTrendChart = dynamic(() => import('@/components/charts/YearTrendChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const RatingChart = dynamic(() => import('@/components/charts/RatingChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const GenreChart = dynamic(() => import('@/components/charts/GenreChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const AuthorsChart = dynamic(() => import('@/components/charts/AuthorsChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const MonthlyPaceChart = dynamic(() => import('@/components/charts/MonthlyPaceChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const OriginChart = dynamic(() => import('@/components/charts/OriginChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const PublicationEraChart = dynamic(() => import('@/components/charts/PublicationEraChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });
const CumulativeTrendChart = dynamic(() => import('@/components/charts/CumulativeTrendChart'), { loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-800" /> });

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
        <div className="flex gap-2">
        <a
          href="/api/v1/stats/export"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
        >
          Export CSV
        </a>
        <Link
          href="/"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
        >
          ← Dashboard
        </Link>
       </div>
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

  const [
    kpis,
    ratings,
    authors,
    pace,
    allTimeKpis,
    origins,
    eras,
    cumulative,
    valuable,
    rereads,
    subjects,
    series,
    coverage,
    topAuthorsPages,
    topAuthorsRating,
  ] = await Promise.all([
    getYearKpis(year),
    getRatingDistribution(),
    getTopAuthors(10),
    getMonthlyPace(year),
    getAllTimeKpis(),
    getOriginShares(),
    getPublicationEraBuckets(),
    getCumulativeTrend(),
    getMostValuableBooks(10),
    getRereads(10),
    getTopSubjects(12),
    getSeriesProgress(12),
    getMetadataCoverage(),
    getTopAuthorsByPages(8),
    getTopAuthorsByRating(8),
  ]);
  const discovery = await getDiscoveryMetrics(authors.slice(0, 5));

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

      {/* All-time KPI row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Total books" value={allTimeKpis.totalBooks} tone="emerald" />
        <Kpi label="Completed" value={allTimeKpis.completedBooks} tone="blue" />
        <Kpi label="Active reads" value={allTimeKpis.activeReads} tone="sky" />
        <Kpi label="Unique authors" value={allTimeKpis.uniqueAuthors} tone="amber" />
        <Kpi label="Total pages" value={nf.format(allTimeKpis.totalPages)} tone="purple" />
        <Kpi label="Avg rating" value={allTimeKpis.avgRating === null ? '—' : allTimeKpis.avgRating.toFixed(1)} tone="rose" />
      </section>

      {/* Year KPI row */}
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
        <div className="lg:col-span-2"><CumulativeTrendChart data={cumulative} /></div>
        <RatingChart data={ratings} />
        <GenreChart data={discovery.genreShares} />
        <OriginChart data={origins} />
        <PublicationEraChart data={eras} />
        <MonthlyPaceChart data={pace.points} withoutDates={pace.withoutDates} />
        <AuthorsChart data={authors} />
      </section>

      {/* Most valuable books */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Top 10 most valuable books</h3>
        <div className="space-y-3">
          {valuable.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-bold w-6">{i + 1}</span>
                <Link href={`/books/${b.id}`} className="text-slate-200 hover:text-emerald-300 font-semibold">{b.title}</Link>
                <span className="text-slate-400 text-xs">by {b.author}</span>
              </div>
              <span className="bg-slate-900 px-3 py-1 rounded-md text-emerald-400 font-bold">
                {b.valueScore.toFixed(1)} · {b.rating ?? '—'}/10 · {b.pages ?? '—'}p
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Rankings + recommender — server-rendered lists (CONTEXT.md §4). */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TopAuthorsBooks authors={discovery.topAuthors} booksByAuthor={discovery.topAuthorBooks} />
        <TopList
          title="Top 5 genres"
          items={discovery.topGenres.map((g, i) => ({ id: String(i), label: g.genre ?? 'Sin género', value: `${g.books} books` }))}
        />
        <TopList
          title="Top subjects"
          items={subjects.map((s, i) => ({ id: String(i), label: s.subject, value: `${s.books}` }))}
        />
        <TopList
          title="Top authors by pages"
          items={topAuthorsPages.map((a) => ({ id: a.id, label: a.name, value: `${nf.format(a.pages)} p` }))}
        />
        <TopList
          title="Top authors by rating (≥3 books)"
          items={topAuthorsRating.map((a) => ({ id: a.id, label: a.name, value: `${(a.avgRating ?? 0).toFixed(1)}/10` }))}
        />
        <TopList
          title="Series progress"
          items={series.map((s) => ({ id: s.seriesName, label: s.seriesName, value: `${s.books} books` }))}
        />
        <TopList
          title="Rereads"
          items={rereads.map((r, i) => ({ id: String(i), label: `${r.title} (${r.author})`, value: `${r.count}×` }))}
        />
        <SuggestionsList items={discovery.suggestions} />
      </section>

      {/* Metadata coverage */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="With OL work" value={`${Math.round((coverage.withOpenLibraryWork / Math.max(1, coverage.total)) * 100)}%`} tone="emerald" />
        <Kpi label="With cover" value={`${Math.round((coverage.withCover / Math.max(1, coverage.total)) * 100)}%`} tone="blue" />
        <Kpi label="With pub year" value={`${Math.round((coverage.withPublicationYear / Math.max(1, coverage.total)) * 100)}%`} tone="amber" />
        <Kpi label="With pages" value={`${Math.round((coverage.withPages / Math.max(1, coverage.total)) * 100)}%`} tone="purple" />
      </section>
    </div>
  );
}
