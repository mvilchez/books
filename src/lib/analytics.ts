// src/lib/analytics.ts
import { prisma } from '@/lib/prisma'; // Step 2.3 singleton — NEVER `new PrismaClient()`
import { computeValueScore } from '@/lib/book-value';
import { rankSimilar } from '@/lib/similar-books';
import type { SimilarCandidate } from '@/lib/similar-books';
import type {
  AllTimeKpis, AuthorMetric, AuthorRank, BookRankItem, CumulativePoint,
  DiscoveryMetrics, GenreShare, MetadataCoverage, MonthPacePoint,
  OriginShare, PublicationEraBucket, SeriesProgress, SimilarBook, SubjectShare,
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
    getCompletedGenreRanks(),
    prisma.book.count({ where: { status: 'COMPLETED', genreId: null } }),
  ]);

  return toGenreShares(genres, ungenred);
}

async function getCompletedGenreRanks() {
  return prisma.genre.findMany({
    where: { books: { some: { status: 'COMPLETED' } } },
    select: {
      id: true,
      name: true,
      _count: { select: { books: { where: { status: 'COMPLETED' } } } },
    },
  });
}

function toGenreShares(
  genres: Awaited<ReturnType<typeof getCompletedGenreRanks>>,
  ungenred: number,
): GenreShare[] {
  const shares: GenreShare[] = genres.map((genre) => ({
    genre: genre.name,
    books: genre._count.books,
  }));
  if (ungenred > 0) shares.push({ genre: null, books: ungenred });
  return shares.sort((a, b) => b.books - a.books);
}

/** Top-N authors by completed books (accent-insensitive names already unified on Author.name). */
export async function getTopAuthors(limit = 10): Promise<AuthorRank[]> {
  const authors = await prisma.author.findMany({
    where: { books: { some: { status: 'COMPLETED' } } },
    select: {
      id: true,
      name: true,
      portraitUrl: true,
      portraitSourceUrl: true,
      portraitArtist: true,
      portraitLicense: true,
      portraitLicenseUrl: true,
      _count: { select: { books: { where: { status: 'COMPLETED' } } } },
    },
    orderBy: [{ books: { _count: 'desc' } }, { name: 'asc' }],
    take: limit,
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
    }));
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
export async function getDiscoveryMetrics(
  authorRanks?: AuthorRank[],
): Promise<DiscoveryMetrics> {
  const [rankedAuthors, genreRows, ungenred] = await Promise.all([
    authorRanks ? Promise.resolve(authorRanks) : getTopAuthors(5),
    getCompletedGenreRanks(),
    prisma.book.count({ where: { status: 'COMPLETED', genreId: null } }),
  ]);
  const topAuthors = rankedAuthors.slice(0, 5);
  const genreShares = toGenreShares(genreRows, ungenred);
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

  const topGenreIds = [...genreRows]
    .sort((a, b) => b._count.books - a._count.books)
    .slice(0, 2)
    .map((genre) => genre.id);

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
    genreShares,
    topGenres: genreShares.slice(0, 5),
    suggestions: rows.map((b): Suggestion => ({
      id: b.id,
      title: b.title,
      author: b.author.name,
      genre: b.genre?.name ?? null,
    })),
  };
}

export type RatingTrendPoint = { readingYear: number; avgRating: number | null; ratedBooks: number };

export async function getOriginShares(): Promise<OriginShare[]> {
  const rows = await prisma.book.groupBy({
    by: ["origin"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = r.origin?.trim() || "Sin origen";
    const key = ["ebook", "Propio", "Prestado", "Revista"].includes(raw)
      ? raw
      : /^(\d|N )/.test(raw)
        ? "Biblioteca"
        : raw;
    map.set(key, (map.get(key) ?? 0) + r._count._all);
  }
  return [...map.entries()]
    .map(([origin, books]) => ({ origin, books }))
    .sort((a, b) => b.books - a.books);
}

export async function getPublicationEraBuckets(): Promise<PublicationEraBucket[]> {
  const rows = await prisma.book.findMany({
    where: { status: "COMPLETED", publicationYear: { not: null } },
    select: { publicationYear: true },
  });
  const buckets = new Map<string, number>();
  for (const { publicationYear } of rows) {
    const y = publicationYear!;
    const era =
      y < 0
        ? "Antigua"
        : y < 1500
          ? "Medieval"
          : y < 1800
            ? "Moderna temprana"
            : y < 1900
              ? "Siglo XIX"
              : y < 2000
                ? "Siglo XX"
                : "Siglo XXI";
    buckets.set(era, (buckets.get(era) ?? 0) + 1);
  }
  const unknown = await prisma.book.count({
    where: { status: "COMPLETED", publicationYear: null },
  });
  if (unknown > 0) buckets.set("Desconocido", unknown);
  const order = [
    "Antigua",
    "Medieval",
    "Moderna temprana",
    "Siglo XIX",
    "Siglo XX",
    "Siglo XXI",
    "Desconocido",
  ];
  return order
    .filter((e) => buckets.has(e))
    .map((e) => ({ era: e, books: buckets.get(e)! }));
}

export async function getAllTimeKpis(): Promise<AllTimeKpis> {
  const [
    totalBooks,
    completedBooks,
    activeReads,
    uniqueAuthors,
    pagesAgg,
    ratedAgg,
    unratedBooks,
    longestAgg,
    shortestAgg,
    topAuthor,
  ] = await Promise.all([
    prisma.book.count(),
    prisma.book.count({ where: { status: "COMPLETED" } }),
    prisma.book.count({ where: { status: "READING" } }),
    prisma.author.count(),
    prisma.book.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalPages: true },
    }),
    prisma.book.aggregate({
      where: { status: "COMPLETED", rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.book.count({ where: { status: "COMPLETED", rating: null } }),
    prisma.book.aggregate({
      where: { status: "COMPLETED", totalPages: { not: null } },
      _max: { totalPages: true },
    }),
    prisma.book.aggregate({
      where: { status: "COMPLETED", totalPages: { not: null } },
      _min: { totalPages: true },
    }),
    getTopAuthors(1),
  ]);
  return {
    totalBooks,
    completedBooks,
    activeReads,
    uniqueAuthors,
    totalPages: pagesAgg._sum.totalPages ?? 0,
    avgRating: ratedAgg._avg.rating ?? null,
    unratedBooks,
    longestBookPages: longestAgg._max.totalPages ?? null,
    shortestBookPages: shortestAgg._min.totalPages ?? null,
    mostProlificAuthor: topAuthor[0]?.name ?? null,
    mostProlificAuthorBooks: topAuthor[0]?.books ?? 0,
  };
}

export async function getCumulativeTrend(): Promise<CumulativePoint[]> {
  const trend = await getYearlyTrend();
  let cb = 0;
  let cp = 0;
  return trend.map((p) => {
    cb += p.books;
    cp += p.pages;
    return {
      readingYear: p.readingYear,
      books: p.books,
      pages: p.pages,
      cumulativeBooks: cb,
      cumulativePages: cp,
    };
  });
}

export async function getMostValuableBooks(
  limit = 10,
  mode: "value" | "rating" | "pages" | "ratingPerPage" | "rereads" = "value",
): Promise<BookRankItem[]> {
  const rows = await prisma.book.findMany({
    where: { status: "COMPLETED" },
    select: {
      id: true,
      title: true,
      readingYear: true,
      rating: true,
      totalPages: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.title}::${r.authorId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const items: BookRankItem[] = rows.map((r) => {
    const rereadCount = counts.get(`${r.title}::${r.authorId}`) ?? 1;
    const valueScore =
      mode === "value"
        ? computeValueScore({
            rating: r.rating,
            pages: r.totalPages,
            rereadCount,
          })
        : mode === "rating"
          ? r.rating ?? 0
          : mode === "pages"
            ? r.totalPages ?? 0
            : mode === "ratingPerPage"
              ? (r.rating ?? 0) / Math.max(1, r.totalPages ?? 1)
              : rereadCount;
    return {
      id: r.id,
      title: r.title,
      author: r.author.name,
      rating: r.rating,
      pages: r.totalPages,
      readingYear: r.readingYear,
      valueScore,
      rereadCount,
    };
  });

  if (mode === "value")
    items.sort(
      (a, b) =>
        b.valueScore - a.valueScore ||
        (b.rating ?? 0) - (a.rating ?? 0),
    );
  else if (mode === "rating")
    items.sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) || (b.pages ?? 0) - (a.pages ?? 0),
    );
  else if (mode === "pages")
    items.sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0));
  else if (mode === "ratingPerPage")
    items.sort(
      (a, b) =>
        b.valueScore - a.valueScore || (b.rating ?? 0) - (a.rating ?? 0),
    );
  else items.sort((a, b) => b.rereadCount - a.rereadCount);

  return items.slice(0, limit);
}

export async function getTopAuthorsByPages(limit = 10): Promise<AuthorMetric[]> {
  const authors = await prisma.author.findMany({
    include: {
      books: {
        where: { status: "COMPLETED" },
        select: { totalPages: true, rating: true },
      },
    },
  });
  return authors
    .map((a) => {
      const rated = a.books.filter((b) => b.rating != null);
      return {
        id: a.id,
        name: a.name,
        books: a.books.length,
        pages: a.books.reduce((s, b) => s + (b.totalPages ?? 0), 0),
        avgRating:
          rated.length > 0
            ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length
            : null,
      };
    })
    .filter((a) => a.books > 0)
    .sort((a, b) => b.pages - a.pages)
    .slice(0, limit);
}

export async function getTopAuthorsByRating(limit = 10): Promise<AuthorMetric[]> {
  const authors = await prisma.author.findMany({
    include: {
      books: {
        where: { status: "COMPLETED" },
        select: { totalPages: true, rating: true },
      },
    },
  });
  return authors
    .map((a) => {
      const rated = a.books.filter((b) => b.rating != null);
      return {
        id: a.id,
        name: a.name,
        books: a.books.length,
        pages: a.books.reduce((s, b) => s + (b.totalPages ?? 0), 0),
        avgRating:
          rated.length > 0
            ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length
            : null,
      };
    })
    .filter((a) => a.books >= 3 && a.avgRating != null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, limit);
}

export async function getSeriesProgress(limit = 20): Promise<SeriesProgress[]> {
  const rows = await prisma.book.findMany({
    where: { status: "COMPLETED", seriesName: { not: null } },
    select: { seriesName: true, readingYear: true, rating: true },
  });
  const map = new Map<
    string,
    { books: number; first: number; last: number; sum: number; rated: number }
  >();
  for (const r of rows) {
    const key = r.seriesName!;
    const e = map.get(key) ?? {
      books: 0,
      first: r.readingYear,
      last: r.readingYear,
      sum: 0,
      rated: 0,
    };
    e.books += 1;
    e.first = Math.min(e.first, r.readingYear);
    e.last = Math.max(e.last, r.readingYear);
    if (r.rating != null) {
      e.sum += r.rating;
      e.rated += 1;
    }
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([seriesName, e]) => ({
      seriesName,
      books: e.books,
      firstYear: e.first,
      lastYear: e.last,
      avgRating: e.rated > 0 ? e.sum / e.rated : null,
    }))
    .sort((a, b) => b.books - a.books)
    .slice(0, limit);
}

export async function getTopSubjects(limit = 20): Promise<SubjectShare[]> {
  const rows = await prisma.bookTag.findMany({
    where: { deleted: false, tag: { category: "SUBJECT" } },
    include: { tag: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.tag.name, (map.get(r.tag.name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([subject, books]) => ({ subject, books }))
    .sort((a, b) => b.books - a.books)
    .slice(0, limit);
}

export async function getMetadataCoverage(): Promise<MetadataCoverage> {
  const [total, withOpenLibraryWork, withCover, withPublicationYear, withPages] =
    await Promise.all([
      prisma.book.count(),
      prisma.book.count({ where: { openLibraryWorkId: { not: null } } }),
      prisma.book.count({ where: { openLibraryCoverId: { not: null } } }),
      prisma.book.count({ where: { publicationYear: { not: null } } }),
      prisma.book.count({ where: { totalPages: { not: null } } }),
    ]);
  return {
    total,
    withOpenLibraryWork,
    withCover,
    withPublicationYear,
    withPages,
  };
}

export async function getAverageRatingByYear(): Promise<RatingTrendPoint[]> {
  const rows = await prisma.book.groupBy({
    by: ["readingYear"],
    where: { status: "COMPLETED", rating: { not: null } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({
      readingYear: r.readingYear,
      avgRating: r._avg.rating ?? null,
      ratedBooks: r._count._all,
    }))
    .sort((a, b) => a.readingYear - b.readingYear);
}

export async function getRereads(limit = 20) {
  const rows = await prisma.book.findMany({
    where: { status: "COMPLETED" },
    select: {
      title: true,
      readingYear: true,
      author: { select: { name: true } },
    },
    orderBy: [{ title: "asc" }, { readingYear: "asc" }],
  });
  const map = new Map<string, { title: string; author: string; years: number[] }>();
  for (const r of rows) {
    const key = `${r.title}::${r.author.name}`;
    const e = map.get(key) ?? { title: r.title, author: r.author.name, years: [] };
    e.years.push(r.readingYear);
    map.set(key, e);
  }
  return [...map.values()]
    .filter((e) => e.years.length > 1)
    .map((e) => ({
      title: e.title,
      author: e.author,
      years: [...e.years].sort((a, b) => a - b),
      count: e.years.length,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export async function getSimilarBooks(seedId: string, limit = 5): Promise<SimilarBook[]> {
  const seed = await prisma.book.findUnique({
    where: { id: seedId },
    include: {
      author: true,
      genre: true,
      tags: { where: { deleted: false }, include: { tag: true } },
    },
  });
  if (!seed) return [];

  const candidates = await prisma.book.findMany({
    where: { id: { not: seedId } },
    include: {
      author: true,
      genre: true,
      tags: { where: { deleted: false }, include: { tag: true } },
    },
    take: 500,
  });

  const toCandidate = (b: typeof seed): SimilarCandidate => ({
    id: b.id,
    title: b.title,
    author: b.author.name,
    genre: b.genre?.name ?? null,
    rating: b.rating,
    pages: b.totalPages,
    publicationYear: b.publicationYear,
    subjects: b.tags
      .filter((t) => t.tag.category === "SUBJECT")
      .map((t) => t.tag.name),
  });

  const seedCand = toCandidate(seed);
  const ranked = rankSimilar(
    seedCand,
    candidates.map(toCandidate),
    limit,
  );

  return ranked.map((c) => {
    return {
      id: c.id,
      title: c.title,
      author: c.author,
      genre: c.genre,
      rating: c.rating,
      pages: c.pages,
      score: c.score,
      reasons: c.reasons,
    };
  });
}
