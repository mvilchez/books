"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction } from "@/app/actions/authActions";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; token?: string } | null, formData: FormData) => {
      return (await signupAction(formData)) ?? null;
    },
    null,
  );
  const [sent, setSent] = useState(Boolean(state?.token));

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

          {!sent ? (
            <AuthForm mode="signup" />
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-sm font-semibold text-emerald-300">
                  Check your inbox
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Your account has been created. Click the link below to confirm
                  your email address and activate your account:
                </p>
                <a
                  href={`/verify-email?token=${state?.token ?? ""}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  Confirm email address
                </a>
                <p className="mt-3 text-xs text-slate-500">
                  No email? Check your spam folder, or try again.
                </p>
              </div>
              <AuthForm mode="signup" />
              <p className="mt-6 text-sm text-slate-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Log in
                </Link>
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}