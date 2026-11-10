"use client";

import Link from "next/link";
import { useState } from "react";
import { cacheAllAuthorPortraitsAction } from "@/app/actions/authorPortraitActions";
import {
  CheckIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  LoadingIcon,
} from "@/components/icons";
import DashboardShell from "@/components/DashboardShell";

export default function CacheAuthorPortraitsPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    downloaded: number;
    skipped: number;
    errors: number;
    total: number;
    message: string;
    status: "idle" | "error" | "success";
  } | null>(null);
  const [details, setDetails] = useState<Array<{
    authorId: string;
    name: string;
    status: "downloaded" | "skipped" | "error";
    message: string;
    portraitUrl?: string | null;
  }>>([]);
  const [message, setMessage] = useState("");

  const runCache = async () => {
    setIsRunning(true);
    setResult(null);
    setDetails([]);
    setMessage("");
    try {
      const res = await cacheAllAuthorPortraitsAction();
      setResult({
        downloaded: res.downloaded,
        skipped: res.skipped,
        errors: res.errors,
        total: res.total,
        message: res.message,
        status: res.status,
      });
      setMessage(res.message);
    } catch (error) {
      setMessage(
        `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardShell
      title="Cache author portraits"
      subtitle="Bulk-download missing author portraits from Open Library into public/portraits/"
      search=""
      userName=""
    >
      <div className="max-w-2xl">
        <p className="mb-6 text-sm text-slate-400">
          Scans every author that does not already have a local
          <code className="text-slate-300">/portraits/...</code> portrait,
          looks up a photo on Open Library, converts it to WebP, saves it to
          <code className="text-slate-300">public/portraits/</code>, and updates
          the author record. One author at a time, with a small delay between
          requests to stay polite to Open Library.
        </p>

        <button
          onClick={runCache}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-900/40 hover:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <LoadingIcon /> Caching…
            </>
          ) : (
            <>
              <RefreshCwIcon /> Cache all missing author portraits
            </>
          )}
        </button>

        {result && (
          <div
            className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
              result.status === "success"
                ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-300"
                : "border-red-500/30 bg-red-900/20 text-red-300"
            }`}
          >
            <p className="font-semibold">{result.message}</p>
            <p className="mt-1 text-xs text-slate-400">
              {result.total} author(s) without a local portrait were processed.
            </p>
          </div>
        )}

        {message && !result && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">
            {message}
          </div>
        )}

        {details.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Details ({details.length})
            </h2>
            <div className="rounded-lg border border-slate-800 bg-slate-950 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-3 py-2 font-medium text-slate-400">
                      Status
                    </th>
                    <th className="px-3 py-2 font-medium text-slate-400">
                      Author
                    </th>
                    <th className="px-3 py-2 font-medium text-slate-400">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d) => (
                    <tr key={d.authorId} className="border-b border-slate-900/50">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            d.status === "downloaded"
                              ? "border-emerald-600/30 bg-emerald-900/30 text-emerald-400"
                              : d.status === "skipped"
                              ? "border-slate-600/30 bg-slate-900/30 text-slate-400"
                              : "border-red-600/30 bg-red-900/30 text-red-400"
                          }`}
                        >
                          {d.status === "downloaded" ? (
                        <CheckIcon />
                      ) : d.status === "skipped" ? (
                        <span className="h-3 w-3">↷</span>
                      ) : (
                        <AlertCircleIcon />
                      )}
                          {d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-200 truncate max-w-[200px]">
                        {d.name}
                      </td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[260px]">
                        {d.message}
                        {d.portraitUrl && (
                          <span className="ml-2 text-[10px] text-emerald-400">
                            → {d.portraitUrl}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <p className="mt-8 text-xs text-slate-500">
        Tip: run this after importing books so every author with an Open Library
        photo gets a local, browser-friendly portrait.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
      >
        <span>←</span> Return to dashboard
      </Link>
    </DashboardShell>
  );
}