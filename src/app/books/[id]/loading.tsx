export default function BookDetailLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading book details"
      className="min-h-screen bg-slate-900 p-6 md:p-12"
    >
      <div className="mx-auto mt-12 h-96 max-w-4xl animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800" />
    </main>
  );
}
