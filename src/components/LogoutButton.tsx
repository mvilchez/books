"use client";

import { logoutAction } from "@/app/actions/authActions";

export function LogoutButton({
  className,
  label = "Log out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-500/50 hover:text-red-300"
        }
      >
        {label}
      </button>
    </form>
  );
}

export default LogoutButton;
