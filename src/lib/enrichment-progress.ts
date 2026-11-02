/**
 * In-memory progress tracker for the author nationality enrichment job.
 *
 * The enrichment POST is a single long-running request that processes authors
 * sequentially. The client polls this store to surface incremental progress
 * instead of sitting at 0% until the whole job finishes.
 *
 * Only one enrichment runs at a time, so a single module-level record is
 * sufficient (no job IDs needed).
 */
export interface EnrichmentProgress {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Authors whose nationality is still unknown (total − updated). */
  unknown: number;
  status: "idle" | "running" | "completed" | "error";
}

let current: EnrichmentProgress = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  unknown: 0,
  status: "idle",
};

export function getProgress(): EnrichmentProgress {
  return { ...current };
}

export function setProgress(patch: Partial<EnrichmentProgress>): void {
  current = { ...current, ...patch };
}

export function resetProgress(): void {
  current = {
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    unknown: 0,
    status: "idle",
  };
}
