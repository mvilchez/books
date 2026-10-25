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
    <form action={formAction} className="space-y-4">
      {mode === "signup" && (
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
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
        className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
      </button>
    </form>
  );
}