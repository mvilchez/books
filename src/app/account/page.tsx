"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PersonalProfileForm } from "./PersonalProfileForm";
import { AlertCircleIcon } from "@/components/icons";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { buildPreferenceProfileAction } from "@/app/actions/personalizedRecommendationsActions";

type User = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  role: "USER" | "ADMIN";
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [result, setResult] = useState<{ status: string; message: string } | null>(
    null
  );

  useEffect(() => {
    ;(async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    })();
  }, []);

  const handleBuild = async () => {
    if (!user) return;
    const formData = new FormData();
    const response = await buildPreferenceProfileAction(
      { status: "idle" as const, message: "" },
      formData
    );
    setResult({
      status: response.status,
      message: response.message,
    });
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8">
      {user ? (
        <div>
          <h2 className="text-xl font-bold text-white">My account</h2>
          <p className="mb-3 text-slate-400">
            Your name and email address are shown on your reading profile.
          </p>
          <PersonalProfileForm />

          <h3 className="mt-6 text-lg font-semibold text-white">
            Preference Profile
          </h3>
          <p className="mb-3 text-slate-400">
            Build a preference profile from your high-rated completed books to
            improve personalized recommendations.
          </p>
          <form onSubmit={e => {
            e.preventDefault();
            handleBuild();
          }}>
            <button
              type="submit"
              className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Build Preference Profile
            </button>
          </form>

          {result && (
            <div className="mb-5 rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p
                className="text-slate-300 font-medium"
                role={result.status === "success" ? "status" : "alert"}
              >
                {result.message}
              </p>
            </div>
          )}

          <h3 className="mt-6 text-lg font-semibold text-white">Password</h3>
          <p className="mb-3 text-slate-400">
            Update your password. All active sessions are revoked on change.
          </p>
          <ChangePasswordForm />

          {!user.emailVerified && (
            <section
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
            >
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
      ) : (
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-white">My account</h2>
          <p className="mb-6 text-slate-400">
            Loading account information...
          </p>
        </div>
      )}
    </div>
  );
}