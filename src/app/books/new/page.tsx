import Link from "next/link";
import { Suspense } from "react";
import NewReadingBookForm from "@/components/NewReadingBookForm";

export default function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string | string[];
    author?: string | string[];
    seriesName?: string | string[];
    seriesPosition?: string | string[];
    titleSuggestions?: string | string[];
    authorSuggestions?: string | string[];
  }>;
}) {
  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← Dashboard
        </Link>
        <section className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-800 p-6 shadow-xl md:p-8">
          <h1 className="text-2xl font-extrabold text-white">Start a book</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add a book to your currently reading list.
          </p>
          <div className="mt-8">
            <Suspense
              fallback={
                <p role="status" className="text-sm text-slate-400">
                  Loading book form…
                </p>
              }
            >
              <PrefilledBookForm searchParams={searchParams} />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

async function PrefilledBookForm({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string | string[];
    author?: string | string[];
    seriesName?: string | string[];
    seriesPosition?: string | string[];
    titleSuggestions?: string | string[];
    authorSuggestions?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const safeValue = (value: string | string[] | undefined, maxLength: number) =>
    typeof value === "string" && value.length <= maxLength ? value : "";
  const safeList = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
      .filter((item) => item.length <= 191)
      .slice(0, 50);
  return (
    <NewReadingBookForm
      initialTitle={safeValue(params.title, 191)}
      initialAuthor={safeValue(params.author, 191)}
      initialSeriesName={safeValue(params.seriesName, 191)}
      initialSeriesPosition={safeValue(params.seriesPosition, 30)}
      titleSuggestions={safeList(params.titleSuggestions)}
      authorSuggestions={safeList(params.authorSuggestions)}
    />
  );
}
