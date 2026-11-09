import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_27rem] lg:gap-16 lg:px-10">
        <section className="hidden lg:block">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-emerald-400">
            Books · Reading tracker
          </p>
          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight text-white">
            Your reading life, all in one place.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-400">
            Keep your books, reading progress, and yearly insights together.
          </p>
        </section>
        <section className="lg:block flex items-center justify-center">
          <img
            src="/books-logo.png"
            alt="Books logo"
            className="h-20 w-auto"
          />
        </section>
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 lg:hidden">
              Books · Reading tracker
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Log in to continue to your library.
            </p>
          </div>
          <AuthForm mode="login" />
          <p className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">
            No account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Sign up
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}