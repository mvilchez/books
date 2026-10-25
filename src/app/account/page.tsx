import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import Link from "next/link";

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
      <h1 className="mb-2 text-2xl font-bold text-white">Change password</h1>
      <p className="mb-6 text-sm text-slate-400">{user.email}</p>
      <ChangePasswordForm />
      <p className="mt-4 text-sm text-slate-400">
        <Link href="/" className="text-indigo-400 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
