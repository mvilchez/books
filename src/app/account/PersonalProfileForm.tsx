"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/authActions";

type ProfileState = { success: string | null; error: string | null };

const initialState: ProfileState = { success: null, error: null };

export function PersonalProfileForm() {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    async (_prev: ProfileState, formData: FormData) => {
      return (await saveProfileAction(formData)) ?? null;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          className="block text-sm font-medium text-slate-300"
          htmlFor="profileName"
        >
          Name
        </label>
        <input
          id="profileName"
          name="name"
          type="text"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          placeholder="Your display name"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-slate-300"
          htmlFor="profileEmail"
        >
          Email
        </label>
        <input
          id="profileEmail"
          name="email"
          type="email"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          placeholder="you@example.com"
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
        className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}