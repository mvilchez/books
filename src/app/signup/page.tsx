import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_27rem] lg:gap-16 lg:px-10">
        <section className="hidden lg:block">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-emerald-400">
            Books · Reading tracker
          </p>
          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight text-white">
            Make room for your next great read.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-400">
            Build your library, follow your progress, and discover your reading
            patterns.
          </p>
        </section>
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 lg:hidden">
              Books · Reading tracker
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Start keeping your reading life in one place.
            </p>
          </div>
          <AuthForm mode="signup" />
          <p className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Log in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}