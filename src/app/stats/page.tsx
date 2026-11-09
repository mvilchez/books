// src/app/stats/page.tsx
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import DisclosurePanel from '@/components/DisclosurePanel';
import { PRE_TAB_READING_YEAR_SENTINEL } from '@/lib/ingestion/workbook-parser';
import {
  getAllTimeKpis, getCumulativeTrend, getDiscoveryMetrics, getMetadataCoverage,
  getMonthlyPace, getMostValuableBooks, getOriginShares, getPublicationEraBuckets,
  getRatingDistribution, getRereads, getSeriesProgress, getTopAuthors,
  getTopAuthorsByPages, getTopAuthorsByRating, getTopSubjects, getYearKpis, getYearlyTrend,
  getCountryStats,
} from '@/lib/analytics';
import { Kpi, nf, StatsSkeleton, SuggestionsList, TopAuthorsBooks, TopList, RecommendationsList } from './_components';

const chartLoading = () => (
  <div className="h-[min(70vw,360px)] min-h-56 animate-pulse rounded-xl bg-slate-800" />
);
const YearTrendChart = dynamic(() => import('@/components/charts/YearTrendChart'), { loading: chartLoading });
const RatingChart = dynamic(() => import('@/components/charts/RatingChart'), { loading: chartLoading });
const GenreChart = dynamic(() => import('@/components/charts/GenreChart'), { loading: chartLoading });
const AuthorsChart = dynamic(() => import('@/components/charts/AuthorsChart'), { loading: chartLoading });
const MonthlyPaceChart = dynamic(() => import('@/components/charts/MonthlyPaceChart'), { loading: chartLoading });
const NationalityChart = dynamic(() => import('@/components/charts/NationalityChart'), { loading: chartLoading });
const OriginChart = dynamic(() => import('@/components/charts/OriginChart'), { loading: chartLoading });
const PublicationEraChart = dynamic(() => import('@/components/charts/PublicationEraChart'), { loading: chartLoading });
const CumulativeTrendChart = dynamic(() => import('@/components/charts/CumulativeTrendChart'), { loading: chartLoading });

// PageProps<'/stats'> is a Next.js-generated global helper (no import needed).
type StatsSearchParams = PageProps<'/stats'>['searchParams'];

export default function StatsPage(props: PageProps<'/stats'>) {
  return (
    <main className="stats-dashboard min-h-screen bg-slate-900 text-slate-100">
      <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Your reading, at a glance
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Reading statistics
          </h1>
          <p className="mt-1 text-sm text-slate-400 sm:text-base">
            Trends, rankings, and insights from your library.
          </p>
        </div>
        <nav aria-label="Statistics actions" className="flex flex-wrap gap-2">
          <a
            href="/api/v1/stats/export"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Export CSV
          </a>
          <Link
            href="/stats/countries"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Mapa mundi
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            ← Dashboard
          </Link>
        </nav>
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

  const authorsPromise = getTopAuthors(10);
  const discoveryPromise = authorsPromise.then((authors) =>
    getDiscoveryMetrics(authors.slice(0, 5)),
  );
  const [
    authors,
    [
      kpis,
      ratings,
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
      countryStats,
    ],
    discovery,
  ] = await Promise.all([
    authorsPromise,
    Promise.all([
      getYearKpis(year),
      getRatingDistribution(),
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
      getCountryStats(),
    ]),
    discoveryPromise,
  ]);

  return (
    <div className="space-y-5 sm:space-y-7">
      <DisclosurePanel
        title="Choose reading year"
        summary={`${year === PRE_TAB_READING_YEAR_SENTINEL ? 'pre-2008' : year} · ${availableYears.length} years`}
      >
        <nav className="flex flex-wrap gap-2" aria-label="Reading year">
          {availableYears.map((y) => (
            <Link
              key={y}
              href={`/stats?year=${y}`}
              aria-current={y === year ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-semibold transition ${
                y === year
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >
              {y === PRE_TAB_READING_YEAR_SENTINEL ? 'pre-2008' : y}
            </Link>
          ))}
        </nav>
      </DisclosurePanel>

      <DisclosurePanel
        title="All-time overview"
        summary={`${nf.format(allTimeKpis.totalBooks)} books · ${nf.format(allTimeKpis.totalPages)} pages`}
      >
      <section aria-label="All-time statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total books" value={allTimeKpis.totalBooks} tone="emerald" />
        <Kpi label="Completed" value={allTimeKpis.completedBooks} tone="blue" />
        <Kpi label="Active reads" value={allTimeKpis.activeReads} tone="sky" />
        <Kpi label="Unique authors" value={allTimeKpis.uniqueAuthors} tone="amber" />
        <Kpi label="Total pages" value={nf.format(allTimeKpis.totalPages)} tone="purple" />
        <Kpi label="Avg rating" value={allTimeKpis.avgRating === null ? '—' : allTimeKpis.avgRating.toFixed(1)} tone="rose" />
      </section>
      </DisclosurePanel>

      <DisclosurePanel
        title={`${year === PRE_TAB_READING_YEAR_SENTINEL ? 'Pre-2008' : year} overview`}
        summary={`${kpis.booksCompleted} completed · ${nf.format(kpis.pagesRead)} pages`}
      >
      <section aria-label={`${year} statistics`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Books completed" value={kpis.booksCompleted} tone="emerald" />
        <Kpi label="Pages read" value={nf.format(kpis.pagesRead)} tone="blue" />
        <Kpi label="Avg pages / book" value={kpis.avgPagesPerBook} tone="amber" />
        <Kpi label="Avg pages / day" value={kpis.avgPagesPerDay} tone="purple" />
        <Kpi label="Avg rating" value={kpis.avgRating === null ? '—' : kpis.avgRating.toFixed(1)} tone="rose" />
        <Kpi label="Active reads" value={kpis.activeReads} tone="sky" />
      </section>
      </DisclosurePanel>

      <section aria-labelledby="trends-heading" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Explore</p>
          <h2 id="trends-heading" className="mt-1 text-xl font-bold text-white">Reading trends</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="lg:col-span-2"><YearTrendChart data={trend} /></div>
          <div className="lg:col-span-2"><CumulativeTrendChart data={cumulative} /></div>
        </div>
      </section>

      <section aria-labelledby="habits-heading" className="space-y-4">
        <div>
          <h2 id="habits-heading" className="text-xl font-bold text-white">Reading habits &amp; discovery</h2>
          <p className="mt-1 text-sm text-slate-400">Ratings, genres, pace, and favorite authors.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <RatingChart data={ratings} />
          <GenreChart data={discovery.genreShares} />
          <MonthlyPaceChart data={pace.points} withoutDates={pace.withoutDates} />
          <AuthorsChart data={authors} />
        </div>
      </section>

      <section aria-labelledby="collection-heading" className="space-y-4">
        <div>
          <h2 id="collection-heading" className="text-xl font-bold text-white">Your collection</h2>
          <p className="mt-1 text-sm text-slate-400">Formats, publication eras, and book value.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <OriginChart data={origins} />
          <NationalityChart data={countryStats} />
          <PublicationEraChart data={eras} />
        </div>
      </section>

      <DisclosurePanel title="Rankings & recommendations" summary="Authors, genres, series, and more">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-4">Top 10 most valuable books</h3>
        <div className="space-y-3">
          {valuable.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-slate-500 font-bold w-6">{i + 1}</span>
                <Link href={`/books/${b.id}`} className="text-slate-200 hover:text-emerald-300 font-semibold">{b.title}</Link>
                <span className="text-slate-400 text-xs">by {b.author}</span>
              </div>
              <span className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-400">
                {b.valueScore.toFixed(1)} · {b.rating ?? '—'}/10 · {b.pages ?? '—'}p
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Rankings + recommender — server-rendered lists (CONTEXT.md §4). */}
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
        <RecommendationsList
  items={discovery.personalizedRecommendations ?? []}
/>
      </section>
      </DisclosurePanel>

      <DisclosurePanel title="Metadata coverage" summary={`${coverage.total} books checked`}>
      <section aria-label="Metadata coverage" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="With OL work" value={`${Math.round((coverage.withOpenLibraryWork / Math.max(1, coverage.total)) * 100)}%`} tone="emerald" />
        <Kpi label="With cover" value={`${Math.round((coverage.withCover / Math.max(1, coverage.total)) * 100)}%`} tone="blue" />
        <Kpi label="With pub year" value={`${Math.round((coverage.withPublicationYear / Math.max(1, coverage.total)) * 100)}%`} tone="amber" />
        <Kpi label="With pages" value={`${Math.round((coverage.withPages / Math.max(1, coverage.total)) * 100)}%`} tone="purple" />
      </section>
      </DisclosurePanel>
    </div>
  );
}
