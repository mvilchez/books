import type { ReadingStatus } from "@prisma/client";

export function getBookStatusPresentation(status: ReadingStatus): {
  label: string;
  card: string;
  badge: string;
  row: string;
  progress: string;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Read",
        card: "border-emerald-500/40 bg-gradient-to-br from-emerald-950/70 to-slate-800",
        badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        row: "border-l-2 border-l-emerald-400 bg-emerald-950/25 hover:bg-emerald-950/40",
        progress: "from-emerald-400 to-teal-300",
      };
    case "READING":
      return {
        label: "Reading",
        card: "border-blue-500/40 bg-gradient-to-br from-blue-950/70 to-slate-800",
        badge: "border-blue-400/30 bg-blue-400/10 text-blue-300",
        row: "border-l-2 border-l-blue-400 bg-blue-950/25 hover:bg-blue-950/40",
        progress: "from-blue-400 to-cyan-300",
      };
    case "WISH_LIST":
      return {
        label: "Wish list",
        card: "border-violet-500/40 bg-gradient-to-br from-violet-950/60 to-slate-800",
        badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
        row: "border-l-2 border-l-violet-400 bg-violet-950/20 hover:bg-violet-950/35",
        progress: "from-violet-400 to-fuchsia-300",
      };
    case "PENDING":
      return {
        label: "Not started",
        card: "border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-slate-800",
        badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        row: "border-l-2 border-l-amber-400 bg-amber-950/20 hover:bg-amber-950/35",
        progress: "from-amber-400 to-orange-300",
      };
  }
}
