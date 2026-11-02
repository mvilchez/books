"use client";

import { useId, useState, type ReactNode } from "react";

export default function DisclosurePanel({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-800/40">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-800/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400 sm:px-5"
      >
        <span className="min-w-0 flex-1 truncate font-semibold text-white">{title}</span>
        <span className="ml-auto max-w-[48%] truncate text-right text-sm text-slate-400">{summary}</span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-600 text-emerald-300"
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>
      <div id={contentId} hidden={!isOpen} className="border-t border-slate-700/70 p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}
