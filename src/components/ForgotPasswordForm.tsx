"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/authActions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (
      _previous: { error?: string; success?: string } | null,
      formData: FormData,
    ) => (await requestPasswordResetAction(formData)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          className="block text-sm font-semibold text-slate-300"
          htmlFor="resetEmail"
        >
          Email
        </label>
        <input
          id="resetEmail"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-400" role="status">
          {state.success}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-emerald-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Please wait…" : "Send reset link"}
      </button>
    </form>
  );
}
