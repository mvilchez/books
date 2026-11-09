"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/authActions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    async (
      _previous: { error?: string; success?: string } | null,
      formData: FormData,
    ) => (await resetPasswordAction(formData)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label
          className="block text-sm font-semibold text-slate-300"
          htmlFor="newPassword"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />
      </div>
      <div>
        <label
          className="block text-sm font-semibold text-slate-300"
          htmlFor="confirmPassword"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
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
        {pending ? "Updating…" : "Reset password"}
      </button>
    </form>
  );
}
