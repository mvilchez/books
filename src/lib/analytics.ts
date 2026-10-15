// src/lib/analytics.ts
import { prisma } from '@/lib/prisma'; // Step 2.3 singleton — NEVER `new PrismaClient()`
import type {
  AuthorRank, DiscoveryMetrics, GenreShare, MonthPacePoint,
  RatingDistribution, Suggestion, YearKpis, YearlyTrendPoint,
} from '@/lib/analytics-types';

/**
 * Phase 5 analytics engine — every query the /stats view needs.
 * Returned Dates are UTC-midnight values (MariaDB DATETIME has no timezone),
 * so month bucketing MUST use the UTC getters, never the local ones.
 */

/** CONTEXT.md §4 leap-year rule. */
function daysInReadingYear(year: number): 366 | 365 {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Books per year + pages per year in one grouped query. */
export async function getYearlyTrend(): Promise<YearlyTrendPoint[]> {
  const rows = await prisma.book.groupBy({
    by: ['readingYear'],
    where: { status: 'COMPLETED' },
    _count: { _all: true },
    _sum: { totalPages: true },
    orderBy: { readingYear: 'asc' },
  });
  return rows.map((r) => ({
    readingYear: r.readingYear,
    books: r._count._all,
    pages: r._sum.totalPages ?? 0, // NULL pages (pre-2014 rows) count as 0
  }));
}

/** KPI block for one reading year. */
export async function getYearKpis(year: number): Promise<YearKpis> {
  const [completed, unrated, active] = await Promise.all([
    prisma.book.aggregate({
      where: { readingYear: year, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { totalPages: true },
      _avg: { rating: true }, // Prisma's _avg skips NULLs = rated-only mean
    }),
    prisma.book.count({ where: { readingYear: year, status: 'COMPLETED', rating: null } }),
    prisma.book.aggregate({
      where: { readingYear: year, status: 'READING' },
      _count: { _all: true },
      _sum: { currentPages: true },
    }),
  ]);

  const pagesInYear = completed._sum.totalPages ?? 0;
  const pagesRead = pagesInYear + (active._sum.currentPages ?? 0);

  return {
    year,
    booksCompleted: completed._count._all,
    pagesRead,
    avgPagesPerBook: completed._count._all > 0 ? Math.round(pagesInYear / completed._count._all) : 0,
    avgPagesPerDay: parseFloat((pagesRead / daysInReadingYear(year)).toFixed(2)),
    avgRating: completed._avg.rating, // number | null
    ratedBooks: completed._count._all - unrated,
    unratedBooks: unrated,
    activeReads: active._count._all,
  };
}

/**
 * Rating histogram (0–10 scale). groupBy cannot express range buckets, so the
 * ~830 ratings are fetched as ONE slim column and bucketed in JS — cheaper and
 * fully type-safe (no raw SQL).
 */
export async function getRatingDistribution(): Promise<RatingDistribution> {
  const [rows, unrated] = await Promise.all([
    prisma.book.findMany({
      where: { status: 'COMPLETED', rating: { not: null } },
      select: { rating: true },
    }),
    prisma.book.count({ where: { status: 'COMPLETED', rating: null } }),
  ]);

  const buckets = new Map<number, number>();
  for (const { rating } of rows) {
    if (rating === null) continue; // narrowing guard; the filter already excludes NULLs
    const bucket = Math.min(10, Math.max(1, Math.round(rating))); // 7.5 → 8
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return {
    buckets: Array.from({ length: 10 }, (_, i) => ({
      rating: i + 1,
      books: buckets.get(i + 1) ?? 0, // fill gaps so the X axis stays stable
    })),
    unrated,
  };
}

/**
 * Genre mix of completed books. Books without a "Tipo" value keep their own
 * `null` bucket — the chart labels it "Sin género" instead of dropping it.
 */
export async function getGenreShares(): Promise<GenreShare[]> {
  const [genres, ungenred] = await Promise.all([
    prisma.genre.findMany({
      where: { books: { some: { status: 'COMPLETED' } } },
      include: { _count: { select: { books: { where: { status: 'COMPLETED' } } } } },
    }),
    prisma.book.count({ where: { status: 'COMPLETED', genreId: null } }),
  ]);

  const shares: GenreShare[] = genres.map((g) => ({ genre: g.name, books: g._count.books }));
  if (ungenred > 0) shares.push({ genre: null, books: ungenred });
  return shares.sort((a, b) => b.books - a.books);
}

/** Top-N authors by completed books (accent-insensitive names already unified on Author.name). */
export async function getTopAuthors(limit = 10): Promise<AuthorRank[]> {
  const authors = await prisma.author.findMany({
    include: { _count: { select: { books: { where: { status: 'COMPLETED' } } } } },
  });
  return authors
    .map((a) => ({
      id: a.id,
      name: a.name,
      books: a._count.books,
      portraitUrl: a.portraitUrl,
      portraitSourceUrl: a.portraitSourceUrl,
      portraitArtist: a.portraitArtist,
      portraitLicense: a.portraitLicense,
      portraitLicenseUrl: a.portraitLicenseUrl,
    }))
    .sort((a, b) => b.books - a.books || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Books finished per month of the selected year. Dates were ingested as UTC
 * midnight (CONTEXT.md §2.3), so use the UTC getters — `getMonth()` would
 * shift buckets under a non-UTC server timezone. Years with sparse date
 * coverage (pre-2014 rows often lack "Fecha Fin") report fewer finishes;
 * `withoutDates` lets the UI say so instead of silently lying.
 */
export async function getMonthlyPace(year: number): Promise<{ points: MonthPacePoint[]; withoutDates: number }> {
  const [rows, withoutDates] = await Promise.all([
    prisma.book.findMany({
      where: { readingYear: year, status: 'COMPLETED', finishDate: { not: null } },
      select: { finishDate: true },
    }),
    prisma.book.count({ where: { readingYear: year, status: 'COMPLETED', finishDate: null } }),
  ]);

  const byMonth = new Map<number, number>();
  for (const { finishDate } of rows) {
    if (!finishDate) continue;
    const month = finishDate.getUTCMonth() + 1; // UTC midnight → 1..12
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  return {
    points: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, books: byMonth.get(i + 1) ?? 0 })),
    withoutDates,
  };
}

/** Top-5 authors / genres + WISH_LIST suggestions (CONTEXT.md §4 recommender rule). */
export async function getDiscoveryMetrics(): Promise<DiscoveryMetrics> {
  const [topAuthors, topGenres] = await Promise.all([getTopAuthors(5), getGenreShares()]);
  const authorBooks = topAuthors.length
    ? await prisma.book.findMany({
        where: {
          status: 'COMPLETED',
          authorId: { in: topAuthors.map((author) => author.id) },
        },
        select: { id: true, title: true, readingYear: true, rating: true, authorId: true },
        orderBy: [{ readingYear: 'desc' }, { title: 'asc' }],
      })
    : [];
  const booksByAuthor = new Map<string, DiscoveryMetrics['topAuthorBooks'][number]['books']>();
  for (const book of authorBooks) {
    const { authorId, ...details } = book;
    booksByAuthor.set(authorId, [...(booksByAuthor.get(authorId) ?? []), details]);
  }

  // The recommender matches WISH_LIST books against the two most consumed
  // genres — it needs genre IDs, so re-read the top-2 with ids included.
  const topGenreRows = await prisma.genre.findMany({
    where: { books: { some: { status: 'COMPLETED' } } },
    include: { _count: { select: { books: { where: { status: 'COMPLETED' } } } } },
  });
  topGenreRows.sort((a, b) => b._count.books - a._count.books);
  const topGenreIds = topGenreRows.slice(0, 2).map((g) => g.id);

  const rows = await prisma.book.findMany({
    where: { status: 'WISH_LIST', genreId: { in: topGenreIds } },
    include: { author: true, genre: true },
    take: 3,
  });

  return {
    topAuthors,
    topAuthorBooks: topAuthors.map((author) => ({
      authorId: author.id,
      books: booksByAuthor.get(author.id) ?? [],
    })),
    topGenres: topGenres.slice(0, 5),
    suggestions: rows.map((b): Suggestion => ({
      id: b.id,
      title: b.title,
      author: b.author.name,
      genre: b.genre?.name ?? null,
    })),
  };
}
