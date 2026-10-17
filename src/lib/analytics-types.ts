/** One point of the books/pages-per-reading-year series. */
export interface YearlyTrendPoint {
  /** 2007 = PRE_TAB_READING_YEAR_SENTINEL for the "Leidos antes" back-catalogue. */
  readingYear: number;
  books: number;
  pages: number; // totalPages summed; NULL pages count as 0
}

/** KPI block for the year selected in /stats?year=. */
export interface YearKpis {
  year: number;
  booksCompleted: number;
  /** completed totalPages + in-progress currentPages (CONTEXT.md §4). */
  pagesRead: number;
  /** Math.round(pagesInYear / books); 0 when the year is empty. */
  avgPagesPerBook: number;
  /** pagesRead / (366 | 365), 2 decimals — leap-year aware (CONTEXT.md §4). */
  avgPagesPerDay: number;
  /** Arithmetic mean over RATED books only; null when none is rated. */
  avgRating: number | null;
  ratedBooks: number;
  unratedBooks: number;
  activeReads: number;
}

/** Integer rating bucket (1..10); half-point ratings (7.5) round to nearest. */
export interface RatingBucket { rating: number; books: number }

export interface RatingDistribution { buckets: RatingBucket[]; unrated: number }

/** Genre share of completed books; `genre: null` = books without a "Tipo" value. */
export interface GenreShare { genre: string | null; books: number }

export interface AuthorRank {
  id: string;
  name: string;
  books: number;
  portraitUrl: string | null;
  portraitSourceUrl: string | null;
  portraitArtist: string | null;
  portraitLicense: string | null;
  portraitLicenseUrl: string | null;
}

export interface AuthorBook {
  id: string;
  title: string;
  readingYear: number;
  rating: number | null;
}

export interface AuthorBookList {
  authorId: string;
  books: AuthorBook[];
}

/** Books finished per calendar month of the selected year (1..12). */
export interface MonthPacePoint { month: number; books: number }

/** WISH_LIST books whose genre matches the reader's top-2 (CONTEXT.md §4). */
export interface Suggestion {
  id: string;
  title: string;
  author: string;
  genre: string | null;
}

export interface DiscoveryMetrics {
  topAuthors: AuthorRank[];  // top 5
  topAuthorBooks: AuthorBookList[];
  genreShares: GenreShare[];
  topGenres: GenreShare[];   // top 5, names resolved
  suggestions: Suggestion[]; // up to 3
}
