import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const validToken =
    typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : null;

  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
        Books · Reading tracker
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">
        Choose a new password
      </h1>
      {validToken ? (
        <>
          <p className="mb-6 mt-2 text-sm text-slate-400">
            Reset links are valid for one hour and can only be used once.
          </p>
          <ResetPasswordForm token={validToken} />
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-400">
            This reset link is invalid. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Request a new reset link
          </Link>
        </div>
      )}
      <p className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">
        <Link
          href="/login"
          className="font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Back to log in
        </Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage(props: ResetPasswordPageProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <Suspense
        fallback={
          <section className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <p className="text-sm text-slate-400">Loading reset form…</p>
          </section>
        }
      >
        <ResetPasswordContent {...props} />
      </Suspense>
    </main>
  );
}
