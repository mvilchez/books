"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveManualBookTags } from "@/app/actions/openLibraryImageActions";
import { normalizeTagName, findSimilarTags } from "@/lib/tag-similarity";

type ExistingSubjectTag = { id: string; name: string };

export default function ManualSubjectTags({
  bookId,
  currentTags,
  existingTags,
}: {
  bookId: string;
  currentTags: string[];
  existingTags: ExistingSubjectTag[];
}) {
  const router = useRouter();
  const listId = useId();
  const [tags, setTags] = useState(currentTags);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const suggestions = useMemo(
    () => findSimilarTags(input, existingTags),
    [existingTags, input],
  );

  function addTag(name: string) {
    const cleanName = name.trim().replace(/[,;\n]+$/u, "").trim();
    if (!cleanName) return;
    if (cleanName.length > 191) {
      setMessage("Each tag must be 191 characters or fewer.");
      return;
    }
    if (
      tags.some(
        (tag) => normalizeTagName(tag) === normalizeTagName(cleanName),
      )
    ) {
      setMessage(`“${cleanName}” is already in this book's tags.`);
      setInput("");
      return;
    }
    setTags((current) => [...current, cleanName]);
    setInput("");
    setMessage("");
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const result = await saveManualBookTags(bookId, tags.join("\n"));
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      setMessage(result.message ?? "Manual tags saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save manual tags.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-700 pt-4">
      <label
        htmlFor={`manual-tags-${bookId}`}
        className="mb-1 block text-sm font-semibold text-slate-300"
      >
        Add or edit manual subject tags
      </label>
      <p className="mb-2 text-xs text-slate-500">
        Type to autocomplete existing subject tags. Press Enter or select a
        suggestion to add it; duplicates ignoring case, accents, and punctuation
        are blocked.
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={normalizeTagName(tag)}
            type="button"
            onClick={() =>
              setTags((current) =>
                current.filter(
                  (item) => normalizeTagName(item) !== normalizeTagName(tag),
                ),
              )
            }
            aria-label={`Remove ${tag}`}
            title="Remove tag"
            className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 hover:bg-rose-500/10 hover:text-rose-200"
          >
            {tag} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className="relative mt-3">
        <input
          id={`manual-tags-${bookId}`}
          value={input}
          maxLength={191}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(input);
            }
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="Start typing a subject tag"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={input.trim().length > 0 && suggestions.length > 0}
        />
        {input.trim() && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-xl"
          >
            {suggestions.map(({ tag, similarity }) => (
              <li key={tag.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  data-tag-suggestion="true"
                  aria-label={`Use existing tag ${tag.name}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(tag.name)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                >
                  <span>{tag.name}</span>
                  <span className="text-xs text-slate-500">
                    {Math.round(similarity * 100)}% similar
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {input.trim() ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span>New tag:</span>
          <button
            type="button"
            onClick={() => addTag(input)}
            className="font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Add “{input.trim()}”
          </button>
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending}
          className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-sm font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save manual tags"}
        </button>
        {message ? (
          <span role="status" className="text-xs text-slate-400">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
