import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PersonalProfileForm } from "./PersonalProfileForm";
import { AlertCircleIcon } from "@/components/icons";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <Suspense fallback={null}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

async function AccountContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My account</h1>
        <Link
          href="/"
          className="text-sm font-semibold text-indigo-400 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="mb-5 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Profile</h2>
        <p className="mb-3 text-sm text-slate-400">
          Your name and email address are shown on your reading profile.
        </p>
        <PersonalProfileForm />
      </section>

      <section className="mb-5 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Password</h2>
        <p className="mb-3 text-sm text-slate-400">
          Update your password. All active sessions are revoked on change.
        </p>
        <ChangePasswordForm />
      </section>

      {!user.emailVerified && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Email not verified
              </p>
              <p className="mt-1 text-sm text-amber-200/80">
                Your email is unverified. Check your inbox for the verification
                link and click it to confirm your address before signing in.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
