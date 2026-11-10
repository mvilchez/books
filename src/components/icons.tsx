import type { ReactNode } from "react";

/**
 * Inline SVG icon set — the project deliberately ships no icon dependency.
 * Every icon renders at 16px, inherits `currentColor`, and is hidden from
 * assistive technology so the accessible name stays on the enclosing
 * button/link.
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      {children}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

export function BooksIcon() {
  return (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

export function ChartIcon() {
  return (
    <Icon>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
    </Icon>
  );
}

export function TagIcon() {
  return (
    <Icon>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <path d="M7 7h.01" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </Icon>
  );
}

export function CopyTagsIcon() {
  return (
    <Icon>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

export function UploadIcon() {
  return (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </Icon>
  );
}

export function ChevronsLeftIcon() {
  return (
    <Icon>
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </Icon>
  );
}

export function ChevronsRightIcon() {
  return (
    <Icon>
      <path d="M13 17l5-5-5-5" />
      <path d="M6 17l5-5-5-5" />
    </Icon>
  );
}

export function ChevronLeftIcon() {
  return (
    <Icon>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  );
}

export function ChevronRightIcon() {
  return (
    <Icon>
      <path d="M9 18l6-6-6-6" />
    </Icon>
  );
}

export function GridIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  );
}

export function ListIcon() {
  return (
    <Icon>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  );
}

export function AlertCircleIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v4l10 8-10 8" />
    </Icon>
  );
}

export function LoadingIcon() {
  return (
    <Icon>
      <path d="M13 2L18 7l-5 5l5 5" />
    </Icon>
  );
}

export function RefreshCwIcon() {
  return (
    <Icon>
      <path d="M12 19c-2 1.1-3.5 2.1-5 3.5s-2.8-2.5-3.5-4.5c-.4-.7-.3-1.1.7-1.5l1.5-1.5c.7-.6 1.5-1.1 2.5-1.3l2.5 1.5c.6.4 1.1.7 1.7.5l1.5-2.5c.4-.6.7-1.1 1.5-1.3l-1.5-2.5zM12 3L2 12l10 10" />
    </Icon>
  );
}

export function DuplicateIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </Icon>
  );
}

export function BookOpenIcon() {
  return (
    <Icon>
      <path d="M2 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
      <path d="M16 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

export function ImageIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Icon>
  );
}

export function GlobeIcon() {
  return (
    <Icon>
      <path d="M12 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2zm5.06 3.75l-1.63 1.63a2.66 2.66 0 0 0 1.41 3.76l1.53 1.53a2.66 2.66 0 0 0 3.75-1.41l-1.53-1.53a2.66 2.66 0 0 0-3.76 1.41z" />
      <circle cx="12" cy="12" r="10" />
    </Icon>
  );
}
