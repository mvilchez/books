import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
          Books · Reading tracker
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Reset your password
        </h1>
        <p className="mb-6 mt-2 text-sm text-slate-400">
          Enter your email and we’ll send a reset link if an account exists.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
