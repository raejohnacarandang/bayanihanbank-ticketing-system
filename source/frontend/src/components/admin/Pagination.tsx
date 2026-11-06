import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Accent = "purple" | "indigo" | "emerald" | "slate";

const ACCENT_ACTIVE: Record<Accent, string> = {
  purple: "bg-purple-700 text-white",
  indigo: "bg-indigo-700 text-white",
  emerald: "bg-emerald-700 text-white",
  slate: "bg-slate-800 text-white",
};

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages (always >= 1). */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Total number of records matching the active filters. */
  total: number;
  /** Records shown per page. */
  pageSize: number;
  /** Plural noun for the record type, e.g. "accounts". */
  itemLabel: string;
  accent?: Accent;
  className?: string;
}
/**
 * Builds a compact page window so long lists never render hundreds of buttons.
 * Always shows the first and last page, the current page and its neighbours.
 */
function buildPageWindow(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  const wanted = new Set<number>([1, count, current]);
  if (current - 1 > 1) wanted.add(current - 1);
  if (current + 1 < count) wanted.add(current + 1);

  const sorted = [...wanted].sort((a, b) => a - b);
  const window: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) window.push("gap");
    window.push(page);
    previous = page;
  }
  return window;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  itemLabel,
  accent = "slate",
  className = "",
}) => {
  if (total === 0) return null;

  const safePage = Math.min(Math.max(page, 1), pageCount);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const activeClass = ACCENT_ACTIVE[accent];

  return (
    <div
      className={`p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <span className="text-[11px] text-slate-500 font-medium">
        Showing{" "}
        <span className="font-bold text-slate-700 tabular-nums">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-bold text-slate-700 tabular-nums">{total}</span>{" "}
        {itemLabel}
      </span>

      {pageCount > 1 && (
        <nav
          className="flex items-center gap-1"
          aria-label={`${itemLabel} pagination`}
        >
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition inline-flex cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {buildPageWindow(safePage, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-[11px] font-bold text-slate-400 select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === safePage ? "page" : undefined}
                className={`min-w-[28px] px-2 py-1 rounded-lg text-[11px] font-bold tabular-nums transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                  entry === safePage
                    ? activeClass
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}
            disabled={safePage === pageCount}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition inline-flex cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
};
