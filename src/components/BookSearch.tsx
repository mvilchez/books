"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BOOK_SEARCH_MIN_LENGTH,
  isBookSearchResults,
  isBookTagSearchResults,
  type BookSearchResult,
  type BookTagSearchResult,
} from "@/lib/book-search";
import AuthorPortrait from "@/components/AuthorPortrait";

const SEARCH_DEBOUNCE_MS = 250;
type SearchResponse = {
  query: string;
  results: BookSearchResult[];
  tags: BookTagSearchResult[];
  error: string | null;
};

type SearchOption =
  | { type: "book"; value: BookSearchResult }
  | { type: "tag"; value: BookTagSearchResult };

export default function BookSearch() {
  const router = useRouter();
  const inputId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = query.trim();
  const currentResponse =
    searchResponse?.query === normalizedQuery ? searchResponse : null;
  const results = currentResponse?.results ?? [];
  const tagResults = currentResponse?.tags ?? [];
  const options: SearchOption[] = [
    ...results.map((value) => ({ type: "book" as const, value })),
    ...tagResults.map((value) => ({ type: "tag" as const, value })),
  ];
  const error = currentResponse?.error ?? null;
  const isLoading =
    normalizedQuery.length >= BOOK_SEARCH_MIN_LENGTH &&
    currentResponse === null;

  useEffect(() => {
    if (normalizedQuery.length < BOOK_SEARCH_MIN_LENGTH) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSearchResponse({
            query: normalizedQuery,
            results: [],
            tags: [],
            error: "Search is temporarily unavailable. Please try again.",
          });
          return;
        }
        const body: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (
          typeof body !== "object" ||
          body === null ||
          !("results" in body) ||
          !isBookSearchResults(body.results) ||
          !("tags" in body) ||
          !isBookTagSearchResults(body.tags)
        ) {
          setSearchResponse({
            query: normalizedQuery,
            results: [],
            tags: [],
            error: "Search returned an invalid response. Please try again.",
          });
          return;
        }
        setSearchResponse({
          query: normalizedQuery,
          results: body.results,
          tags: body.tags,
          error: null,
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setSearchResponse({
          query: normalizedQuery,
          results: [],
          tags: [],
          error: "Search is temporarily unavailable. Please try again.",
        });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery]);

  function chooseOption(option: SearchOption) {
    setIsOpen(false);
    router.push(
      option.type === "book"
        ? `/books/${encodeURIComponent(option.value.id)}`
        : `/tags/${encodeURIComponent(option.value.id)}`,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        options.length === 0 ? -1 : (current + 1) % options.length,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        options.length === 0
          ? -1
          : current <= 0
            ? options.length - 1
            : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = options[activeIndex];
      if (selected) chooseOption(selected);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const statusMessage = isLoading
    ? "Searching books and tags"
    : error
      ? error
      : normalizedQuery.length < BOOK_SEARCH_MIN_LENGTH
        ? "Enter at least 2 characters to search all years"
        : options.length === 0
          ? "No matching books or tags found"
          : `${results.length} books and ${tagResults.length} tags found`;

  return (
    <div
      className="relative w-full max-w-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-semibold text-slate-400"
      >
        Search books, authors, and tags
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen && normalizedQuery.length >= BOOK_SEARCH_MIN_LENGTH}
        aria-controls={resultsId}
        aria-activedescendant={
          activeIndex >= 0 ? `${resultsId}-option-${activeIndex}` : undefined
        }
        aria-describedby={`${resultsId}-status`}
        placeholder="Title, author, or tag"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <p
        id={`${resultsId}-status`}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {statusMessage}
      </p>
      {isOpen && normalizedQuery.length >= BOOK_SEARCH_MIN_LENGTH ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
        <ul id={resultsId} role="listbox" aria-label="Book and tag search results">
            {options.map((option, index) => {
              const isBook = option.type === "book";
              const id = option.value.id;
              const href = isBook ? `/books/${encodeURIComponent(id)}` : `/tags/${encodeURIComponent(id)}`;
              const label = isBook ? option.value.title : option.value.name;
              return (
              <li key={`${option.type}:${id}`} role="presentation">
                <Link
                  id={`${resultsId}-option-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  href={href}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => setIsOpen(false)}
                  className={`w-full px-4 py-3 text-left transition ${
                    activeIndex === index
                      ? "bg-slate-700"
                      : "hover:bg-slate-700/70"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-white">
                    {label}
                  </span>
                  {isBook ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <AuthorPortrait author={option.value.author} links={false} searchLink={false} />
                      <span className="shrink-0 text-xs text-slate-400">
                        {option.value.readingYear === 2007
                          ? "pre-2008"
                          : option.value.readingYear}
                      </span>
                    </div>
                  ) : (
                    <span className="mt-1 block text-xs text-slate-400">
                      {option.value.category.toLowerCase()} · {option.value.bookCount} books
                    </span>
                  )}
                </Link>
              </li>
              );
            })}
          </ul>
          {isLoading || error || options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              {isLoading
                ? "Searching…"
                : error ?? "No matching books or tags found"}
            </p>
          ) : null}
          {currentResponse && !error ? (
            <Link
              href={`/search?q=${encodeURIComponent(normalizedQuery)}`}
              onClick={() => setIsOpen(false)}
              className="block border-t border-slate-700 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-slate-700/70 hover:text-emerald-200"
            >
              View all book search results
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
