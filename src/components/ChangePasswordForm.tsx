"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/authActions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (
      _prev: { error?: string; success?: string } | null,
      formData: FormData,
    ) => {
      return (await changePasswordAction(formData)) ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          className="block text-sm font-medium text-slate-300"
          htmlFor="currentPassword"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-slate-300"
          htmlFor="newPassword"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-slate-300"
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
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
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
        className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
