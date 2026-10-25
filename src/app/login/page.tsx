import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8">
        <h1 className="mb-6 text-2xl font-bold text-white">Log in</h1>
        <AuthForm mode="login" />
        <p className="mt-4 text-sm text-slate-400">
          No account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}