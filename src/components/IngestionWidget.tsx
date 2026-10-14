"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * Header widget that uploads the legacy workbook to POST /api/v1/import
 * (multipart/form-data, `file` field) and refreshes the server-rendered
 * dashboard so new rows appear without a full page load.
 */

/** Success payload mirrors the route's `ImportResult`; errors are `{success:false,error}`. */
interface ImportResponse {
  success: boolean;
  processed?: number;
  created?: number;
  updated?: number;
  errors?: string[];
  error?: string;
}

type WidgetState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export default function IngestionWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<WidgetState>({ kind: "idle" });

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // reset so the same file can be re-selected
    if (!file) return;

    setState({ kind: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | ImportResponse
        | null;

      if (!response.ok || !payload?.success) {
        setState({
          kind: "error",
          text: payload?.error ?? `Import failed (HTTP ${response.status}).`,
        });
        return;
      }

      const skipped = payload.errors?.length ?? 0;
      setState({
        kind: "success",
        text:
          `✓ ${payload.processed} rows · +${payload.created} / ~${payload.updated}` +
          (skipped > 0 ? ` · ${skipped} skipped` : ""),
      });
      router.refresh(); // re-render the server components (book grid)
    } catch {
      setState({ kind: "error", text: "Import failed: network error." });
    }
  }

  const uploading = state.kind === "uploading";

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        aria-label="Workbook file"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {uploading ? "Importing…" : "Import workbook"}
      </button>
      {state.kind === "success" && (
        <span className="text-xs font-semibold text-emerald-400">
          {state.text}
        </span>
      )}
      {state.kind === "error" && (
        <span
          role="alert"
          className="max-w-[22rem] truncate text-xs font-semibold text-rose-400"
          title={state.text}
        >
          {state.text}
        </span>
      )}
    </div>
  );
}
