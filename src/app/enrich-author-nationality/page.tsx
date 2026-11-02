"use client";

import { useEffect, useState } from "react";
import { getAuthorsWithoutNationality } from "@/app/actions/authorNationalityActions";
import { LoadingIcon, CheckIcon, AlertCircleIcon, RefreshCwIcon } from "@/components/icons";

interface AuthorNationality {
  id: string;
  name: string;
  currentNationality: string | null;
  targetNationality: string | null;
  status: "pending" | "completed" | "error";
  progress: number;
}

export default function EnrichAuthorNationalityPage() {
  const [authors, setAuthors] = useState<AuthorNationality[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [message, setMessage] = useState("");

  const loadAuthors = async (): Promise<AuthorNationality[]> => {
    try {
      const data = await getAuthorsWithoutNationality();
      const mapped = data.map((author): AuthorNationality => ({
        id: author.id,
        name: author.name,
        currentNationality: null,
        targetNationality: null,
        status: "pending",
        progress: 0,
      }));
      setAuthors(mapped);
      return mapped;
    } catch (error) {
      setMessage("Failed to load authors");
      return [];
    }
  };

  const startEnrichment = async () => {
    // (Re)load authors first so we work with the latest list, not stale state.
    const freshAuthors = await loadAuthors();

    if (freshAuthors.length === 0) {
      setMessage("No authors without nationality to enrich.");
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setMessage(`Starting enrichment for ${freshAuthors.length} authors...`);

    // Poll server-side progress so the bar moves while the long-running job runs.
    const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    let stopPolling = false;
    const pollProgress = async () => {
      if (stopPolling) return;
      try {
        const res = await fetch(`${base}/api/v1/author-nationality/progress`);
        if (res.ok) {
          const data = await res.json();
          setProgress((data.processed / Math.max(data.total, 1)) * 100);
          setUnknown(data.unknown ?? 0);
          if (data.status === "completed" || data.status === "error") {
            stopPolling = true;
          }
        }
      } catch {
        // Ignore poll failures; the main POST response will surface errors.
      }
    };
    const interval = setInterval(pollProgress, 1000);
    pollProgress();

    try {
      // Call the API route to run the enrichment script
      const response = await fetch(`${base}/api/v1/author-nationality/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ execute: true, limit: 500 }),
      });

      stopPolling = true;
      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enrichment failed');
      }

      const result = await response.json();
      setMessage(result.message || 'Enrichment completed');
      setProgress(100);

      // Reload authors to show updated data
      await loadAuthors();
    } catch (error) {
      stopPolling = true;
      clearInterval(interval);
      console.error('Enrichment error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    loadAuthors();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Author Nationality Enrichment</h1>

      <div className="mb-6">
        <button
          onClick={loadAuthors}
          disabled={isRunning}
          className="mr-2 px-4 py-2 rounded border border-slate-500 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCwIcon /> Refresh List
        </button>
        <button
          onClick={startEnrichment}
          disabled={isRunning || authors.length === 0}
          className="px-4 py-2 rounded bg-emerald-600 text-white"
        >
          {isRunning ? (
            <LoadingIcon />
          ) : (
            "Start Enrichment"
          )}
        </button>
      </div>

      {message ? (
        <div className="mb-4 p-3 rounded bg-slate-900 text-slate-300">{message}</div>
      ) : null}

      {isRunning && (
        <div className="mb-4">
          <p className="text-sm mb-2">
            Processing {progress.toFixed(1)}% complete ({unknown} still unknown)
          </p>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: progress + "%" }}></div>
          </div>
        </div>
      )}

      <table className="w-full border-collapse border border-slate-800">
        <thead>
          <tr>
            <th className="padding px-4 py-2 text-left">#</th>
            <th className="padding px-4 py-2 text-left">Author</th>
            <th className="padding px-4 py-2 text-left">Current</th>
            <th className="padding px-4 py-2 text-left">Target</th>
            <th className="padding px-4 py-2 text-left">Status</th>
          </tr>
        </thead>

        {authors.map((author, index) => (
          <tr key={author.id} className="border-b hover:bg-slate-950/50">
            <td className="padding font-medium">{index + 1}</td>
            <td className="padding">{author.name}</td>
            <td className="padding">{author.currentNationality || "Not set"}</td>
            <td className="padding">{author.targetNationality || "—"}</td>
            <td className="padding">
              <span className="px-2 py-1 rounded text-xs">{author.status}</span>
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
}