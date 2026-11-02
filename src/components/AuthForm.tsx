"use client";

import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/actions/authActions";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await action(formData)) ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      {mode === "signup" && (
        <div>
          <label className="block text-sm font-semibold text-slate-300" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="mt-2 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="mt-2 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-emerald-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
      </button>
    </form>
  );
}