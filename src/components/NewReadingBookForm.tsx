"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createReadingBook,
  type BookFormState,
} from "@/app/actions/bookActions";
import {
  lookupBookByIsbn,
  type IsbnLookupData,
} from "@/app/actions/openLibraryImageActions";
import BookCover from "@/components/BookCover";

const initialState: BookFormState = { status: "idle", message: "" };

type LookupState = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
};

type ScanControls = { stop: () => void };

/** Lazily build a barcode reader restricted to book-barcode formats. */
async function createIsbnReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
    await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  type ReaderHints = NonNullable<
    ConstructorParameters<typeof BrowserMultiFormatReader>[0]
  >;
  const hints: ReaderHints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  return new BrowserMultiFormatReader(hints);
}

export default function NewReadingBookForm({
  initialTitle = "",
  initialAuthor = "",
  initialSeriesName = "",
  initialSeriesPosition = "",
  titleSuggestions = [],
  authorSuggestions = [],
}: {
  initialTitle?: string;
  initialAuthor?: string;
  initialSeriesName?: string;
  initialSeriesPosition?: string;
  titleSuggestions?: string[];
  authorSuggestions?: string[];
}) {
  const [state, formAction, pending] = useActionState(
    createReadingBook,
    initialState,
  );

  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);
  const [startDate, setStartDate] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [genre, setGenre] = useState("");
  const [isbnInput, setIsbnInput] = useState("");
  const [lookup, setLookup] = useState<LookupState>({
    status: "idle",
    message: "",
  });
  const [resolved, setResolved] = useState<IsbnLookupData | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScanControls | null>(null);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    },
    [],
  );

  async function runLookup(rawIsbn: string) {
    setLookup({ status: "pending", message: "" });
    const result = await lookupBookByIsbn(rawIsbn);
    if (result.status === "error") {
      setResolved(null);
      setLookup({ status: "error", message: result.message });
      return;
    }
    const data = result.data;
    setResolved(data);
    setIsbnInput(data.isbn13);
    setTitle(data.title);
    setAuthor(data.author);
    if (data.pageCount !== null) setTotalPages(String(data.pageCount));
    setLookup({
      status: "success",
      message: `Found “${data.title}” by ${data.author}. Review the prefilled details before starting.`,
    });
  }

  async function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function startScan() {
    setLookup({ status: "pending", message: "Starting the camera…" });
    try {
      const reader = await createIsbnReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;
          const text = result.getText();
          void stopScan();
          setIsbnInput(text);
          void runLookup(text);
        },
      );
      controlsRef.current = controls;
      setScanning(true);
      setLookup({
        status: "idle",
        message: "Point the camera at the barcode on the back cover.",
      });
    } catch {
      setScanning(false);
      setLookup({
        status: "error",
        message:
          "Camera scanning is unavailable here (it requires HTTPS and camera permission).",
      });
    }
  }

  async function handlePhotoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setLookup({ status: "pending", message: "Reading the barcode photo…" });
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = await createIsbnReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const text = result.getText();
      setIsbnInput(text);
      await runLookup(text);
    } catch {
      setResolved(null);
      setLookup({
        status: "error",
        message:
          "No book barcode was found in that photo. Try a sharper photo of the barcode, or type the ISBN.",
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
      input.value = "";
    }
  }

  if (state.status === "success") {
    return (
      <div role="status" className="space-y-4">
        <p className="font-semibold text-emerald-400">{state.message}</p>
        <Link
          href={`/?year=${state.year}`}
          className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
        >
          View {state.year} dashboard
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white";

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
        <p className="text-sm font-medium text-slate-300">
          Add by ISBN or barcode{" "}
          <span className="text-slate-500">(optional)</span>
        </p>
        <div className="flex gap-2">
          <input
            id="isbn"
            type="text"
            maxLength={50}
            autoComplete="off"
            placeholder="ISBN, e.g. 978-0-316-20685-3"
            value={isbnInput}
            onChange={(event) => setIsbnInput(event.target.value)}
            aria-label="ISBN"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => void runLookup(isbnInput)}
            disabled={lookup.status === "pending"}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-600 disabled:cursor-wait disabled:opacity-60"
          >
            {lookup.status === "pending" ? "Looking…" : "Look up"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (scanning ? void stopScan() : void startScan())}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            {scanning ? "Stop camera" : "Scan barcode with camera"}
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700">
            Read barcode from photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handlePhotoFile(event)}
            />
          </label>
        </div>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={
            scanning ? "w-full rounded-lg border border-slate-700" : "hidden"
          }
        />
        {lookup.message ? (
          <p
            role={lookup.status === "error" ? "alert" : "status"}
            className={
              lookup.status === "error"
                ? "text-sm text-rose-400"
                : "text-sm text-slate-400"
            }
          >
            {lookup.message}
          </p>
        ) : null}
        {resolved ? (
          <div className="flex items-center gap-4">
            <BookCover
              editionKey={`isbn:${resolved.isbn13}`}
              openLibraryCoverId={resolved.coverId}
              title={resolved.title}
            />
            <p className="text-xs text-slate-400">
              Saved with ISBN-13{" "}
              <span className="font-semibold text-slate-300">
                {resolved.isbn13}
              </span>
              {resolved.publicationYear !== null
                ? ` · ${resolved.publicationYear}`
                : ""}
              . The cover comes from Open Library.
            </p>
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-300">
          Book title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={191}
          list={titleSuggestions.length > 0 ? "saga-title-suggestions" : undefined}
          autoComplete={titleSuggestions.length > 0 ? "on" : "off"}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (resolved && event.target.value !== resolved.title) {
              setResolved(null);
              setLookup({ status: "idle", message: "" });
            }
          }}
          className={inputClass}
        />
        {titleSuggestions.length > 0 ? (
          <datalist id="saga-title-suggestions">
            {titleSuggestions.map((title) => <option key={title} value={title} />)}
          </datalist>
        ) : null}
      </div>
      <div>
        <label htmlFor="author" className="mb-1 block text-sm font-medium text-slate-300">
          Author
        </label>
        <input
          id="author"
          name="author"
          type="text"
          required
          maxLength={191}
          list={authorSuggestions.length > 0 ? "saga-author-suggestions" : undefined}
          autoComplete={authorSuggestions.length > 0 ? "on" : "off"}
          value={author}
          onChange={(event) => {
            setAuthor(event.target.value);
            if (resolved && event.target.value !== resolved.author) {
              setResolved(null);
              setLookup({ status: "idle", message: "" });
            }
          }}
          className={inputClass}
        />
        {authorSuggestions.length > 0 ? (
          <datalist id="saga-author-suggestions">
            {authorSuggestions.map((author) => <option key={author} value={author} />)}
          </datalist>
        ) : null}
      </div>
      {resolved ? (
        <>
          <input type="hidden" name="isbn13" value={resolved.isbn13} />
          {resolved.publicationYear !== null ? (
            <input
              type="hidden"
              name="publicationYear"
              value={resolved.publicationYear}
            />
          ) : null}
          {resolved.coverId !== null ? (
            <input
              type="hidden"
              name="openLibraryCoverId"
              value={resolved.coverId}
            />
          ) : null}
          {resolved.workId ? (
            <input
              type="hidden"
              name="openLibraryWorkId"
              value={resolved.workId}
            />
          ) : null}
        </>
      ) : null}
      {initialSeriesName ? (
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="seriesName" className="mb-1 block text-sm font-medium text-slate-300">
              Saga
            </label>
            <input
              id="seriesName"
              name="seriesName"
              type="text"
              required
              maxLength={191}
              defaultValue={initialSeriesName}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="seriesPosition" className="mb-1 block text-sm font-medium text-slate-300">
              Book number
            </label>
            <input
              id="seriesPosition"
              name="seriesPosition"
              type="number"
              min={0.01}
              step="any"
              defaultValue={initialSeriesPosition}
              className={inputClass}
            />
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-300">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="totalPages" className="mb-1 block text-sm font-medium text-slate-300">
            Total pages <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="totalPages"
            name="totalPages"
            type="number"
            min={1}
            step={1}
            value={totalPages}
            onChange={(event) => {
              setTotalPages(event.target.value);
              if (
                resolved &&
                event.target.value !== String(resolved.pageCount ?? "")
              ) {
                setResolved(null);
                setLookup({ status: "idle", message: "" });
              }
            }}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="genre" className="mb-1 block text-sm font-medium text-slate-300">
          Genre <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="genre"
          name="genre"
          type="text"
          maxLength={191}
          autoComplete="off"
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          className={inputClass}
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-rose-400">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Adding book…" : "Start reading"}
      </button>
    </form>
  );
}


