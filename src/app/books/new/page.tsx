import Link from "next/link";
import NewReadingBookForm from "@/components/NewReadingBookForm";

export default function NewBookPage() {
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
            <NewReadingBookForm />
          </div>
        </section>
      </div>
    </main>
  );
}
