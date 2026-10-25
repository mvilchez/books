import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function LogoutSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <Link
        href="/account"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-300 shadow-lg backdrop-blur transition hover:border-emerald-500/50 hover:text-white"
      >
        Change password
      </Link>
      <LogoutButton
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-300 shadow-lg backdrop-blur transition hover:border-red-500/50 hover:text-red-300"
        label="Log out"
      />
    </div>
  );
}
