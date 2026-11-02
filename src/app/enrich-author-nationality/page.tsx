"use client";

import { useEffect, useState } from "react";
import { getAuthorsWithoutNationality, setAuthorNationality, deleteOrphanAuthorsAction, countOrphanAuthors, getOrphanAuthors } from "@/app/actions/authorNationalityActions";
import { COMMON_COUNTRIES } from "@/lib/author-nationality";
import { LoadingIcon, CheckIcon, AlertCircleIcon, RefreshCwIcon } from "@/components/icons";

interface AuthorNationality {
  id: string;
  name: string;
  currentNationality: string | null;
  targetNationality: string | null;
  status: "pending" | "completed" | "error";
  progress: number;
  selectedNationality: string;
  saving: boolean;
}

export default function EnrichAuthorNationalityPage() {
  const [authors, setAuthors] = useState<AuthorNationality[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [message, setMessage] = useState("");
  const [orphanCount, setOrphanCount] = useState(0);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [orphanAuthors, setOrphanAuthors] = useState<{ id: string; name: string }[]>([]);
  const [showOrphanModal, setShowOrphanModal] = useState(false);
  const [loadingOrphans, setLoadingOrphans] = useState(false);

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
        selectedNationality: "",
        saving: false,
      }));
      setAuthors(mapped);
      return mapped;
    } catch (error) {
      setMessage("Failed to load authors");
      return [];
    }
  };

  const saveNationality = async (authorId: string) => {
    const author = authors.find((a) => a.id === authorId);
    if (!author || !author.selectedNationality) {
      setMessage("Please select a country first.");
      return;
    }
    setAuthors((prev) =>
      prev.map((a) => (a.id === authorId ? { ...a, saving: true } : a)),
    );
    try {
      await setAuthorNationality(authorId, author.selectedNationality);
      setAuthors((prev) => prev.filter((a) => a.id !== authorId));
      setMessage(`Saved nationality for ${author.name}.`);
    } catch (error) {
      setAuthors((prev) =>
        prev.map((a) => (a.id === authorId ? { ...a, saving: false } : a)),
      );
      setMessage(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const loadOrphanCount = async () => {
    try {
      const count = await countOrphanAuthors();
      setOrphanCount(count);
    } catch {
      // ignore
    }
  };

  const openOrphanModal = async () => {
    if (orphanCount === 0) {
      setMessage("No orphan authors to delete.");
      return;
    }
    setLoadingOrphans(true);
    try {
      const list = await getOrphanAuthors();
      setOrphanAuthors(list);
      setShowOrphanModal(true);
    } catch (error) {
      setMessage(`Failed to load orphans: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoadingOrphans(false);
    }
  };

  const confirmDeleteOrphans = async () => {
    setDeletingOrphans(true);
    try {
      const result = await deleteOrphanAuthorsAction();
      setMessage(`Deleted ${result.deleted} orphan author(s).`);
      setShowOrphanModal(false);
      setOrphanAuthors([]);
      await loadOrphanCount();
    } catch (error) {
      setMessage(`Failed to delete orphans: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeletingOrphans(false);
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
    loadOrphanCount();
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
        <button
          onClick={openOrphanModal}
          disabled={loadingOrphans || deletingOrphans || isRunning}
          className="ml-2 px-4 py-2 rounded border border-red-700 text-red-300 transition-colors hover:bg-red-900/50 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingOrphans || deletingOrphans ? (
            <LoadingIcon />
          ) : (
            `Delete Orphan Authors (${orphanCount})`
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
            <th className="padding px-4 py-2 text-left">Nationality</th>
            <th className="padding px-4 py-2 text-left">Action</th>
          </tr>
        </thead>

        {authors.map((author, index) => (
          <tr key={author.id} className="border-b hover:bg-slate-950/50">
            <td className="padding font-medium">{index + 1}</td>
            <td className="padding">{author.name}</td>
            <td className="padding">
              <select
                value={author.selectedNationality}
                onChange={(e) =>
                  setAuthors((prev) =>
                    prev.map((a) =>
                      a.id === author.id
                        ? { ...a, selectedNationality: e.target.value }
                        : a,
                    ),
                  )
                }
                disabled={author.saving || isRunning}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
              >
                <option value="">— Select country —</option>
                {COMMON_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
            </td>
            <td className="padding">
              <button
                onClick={() => saveNationality(author.id)}
                disabled={author.saving || !author.selectedNationality || isRunning}
                className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {author.saving ? <LoadingIcon /> : "Save"}
              </button>
            </td>
          </tr>
        ))}
      </table>

      {showOrphanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-100">
              Orphan Authors ({orphanAuthors.length})
            </h2>
            <p className="mb-4 text-sm text-slate-400">
              These authors have no books and will be permanently deleted:
            </p>
            <ul className="mb-4 max-h-60 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-200">
              {orphanAuthors.map((author) => (
                <li key={author.id} className="py-1">
                  {author.name}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowOrphanModal(false);
                  setOrphanAuthors([]);
                }}
                disabled={deletingOrphans}
                className="px-4 py-2 rounded border border-slate-600 text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteOrphans}
                disabled={deletingOrphans}
                className="px-4 py-2 rounded bg-red-600 text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingOrphans ? <LoadingIcon /> : `Delete ${orphanAuthors.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}