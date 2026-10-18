"use client";

import { useMemo, useState } from "react";
import type { AttendanceReportRow, AttendanceStatus } from "@/lib/attendance";
import LocalTime from "@/app/attendance/LocalTime";
import { AttendanceBadge, EmptyState, Frame, Icon, Initials, MethodTag, PanelHeader } from "@/app/attendance/ui";

/** A roster row; `pending` while a manual record is still being saved. */
export type RosterRow = AttendanceReportRow & { pending?: boolean };

type Filter = "all" | AttendanceStatus;
type SortKey = "name" | "status" | "recorded";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "all", label: "All" },
  { value: "present", label: "Present", dot: "bg-blue" },
  { value: "rejected", label: "Rejected", dot: "bg-[#b3261e]" },
];

const COLUMNS: { label: string; sort?: SortKey }[] = [
  { label: "Student", sort: "name" },
  { label: "Course / year" },
  { label: "Status", sort: "status" },
  { label: "Recorded", sort: "recorded" },
  { label: "Note" },
  { label: "" },
];

const COMPARE: Record<SortKey, (a: RosterRow, b: RosterRow) => number> = {
  name: (a, b) => `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(`${b.last_name ?? ""} ${b.first_name ?? ""}`),
  status: (a, b) => a.status.localeCompare(b.status),
  recorded: (a, b) => a.recorded_at.localeCompare(b.recorded_at),
};

const ICON_BUTTON =
  "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-ink-soft transition-[color,background-color,border-color,opacity] duration-150 hover:border-[#b3261e]/30 hover:bg-[rgba(205,79,60,0.08)] hover:text-[#b3261e] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100";

/** "Last, First", or a placeholder for a manual record whose student hasn't been looked up yet. */
export function rosterName(row: RosterRow): string {
  if (row.last_name || row.first_name) return [row.last_name, row.first_name].filter(Boolean).join(", ");
  return row.pending ? "Looking up student…" : "Unnamed student";
}

export default function RosterTable({
  report,
  exportHref,
  onRemove,
}: {
  report: RosterRow[];
  exportHref: string;
  /** Asks before deleting; the row disappears as soon as it's confirmed. */
  onRemove: (row: RosterRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });

  const counts = useMemo(() => {
    const present = report.filter((row) => row.status === "present").length;
    return { all: report.length, present, rejected: report.length - present };
  }, [report]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = report.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!needle) return true;
      return [row.first_name, row.last_name, row.student_id, row.course, row.year_level, row.recorded_by, row.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => COMPARE[sort.key](a, b) * direction);
  }, [report, query, filter, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : // Newest first is the useful default for times.
          { key, dir: key === "recorded" ? "desc" : "asc" },
    );
  }

  return (
    <Frame className="animate-fade-in-up mb-6 p-0 [animation-delay:0.06s]">
      <PanelHeader icon="users" title="Attendance roster">
        <a
          href={exportHref}
          className="group mono flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-blue no-underline transition-colors duration-150 hover:bg-[#e6f3ff] hover:text-navy"
        >
          <span className="transition-transform duration-150 group-hover:translate-y-px">
            <Icon name="download" size={12} />
          </span>
          Export CSV
        </a>
      </PanelHeader>

      {report.length === 0 ? (
        <EmptyState icon="users" title="NOBODY RECORDED YET">
          Students show up here as soon as they&apos;re scanned or recorded manually.
        </EmptyState>
      ) : (
        <>
          {/* ───────── Toolbar ───────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-rule-soft px-5 py-3">
            <div className="relative w-full sm:w-[280px]">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, ID, course, note"
                aria-label="Search the roster"
                autoComplete="off"
                className="mb-0 rounded-lg py-2 pr-8 pl-9 text-[13px] shadow-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="animate-pop-in absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-soft transition-colors duration-150 hover:bg-[rgba(0,0,0,0.06)] hover:text-navy-deep"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {FILTERS.map((option) => {
                const active = filter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={active}
                    className={`mono flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] tracking-[0.04em] uppercase transition-colors duration-150 ${
                      active
                        ? "border-navy bg-navy text-white"
                        : "border-rule bg-transparent text-ink-soft hover:bg-[rgba(0,0,0,0.05)] hover:text-navy-deep"
                    }`}
                  >
                    {option.dot && <span className={`size-1.5 rounded-full ${option.dot}`} />}
                    {option.label}
                    <span className={`rounded px-1 tabular-nums ${active ? "bg-white/15" : "bg-vellum-2"}`}>
                      {counts[option.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="mono ml-auto text-[10.5px] text-ink-soft">
              {visible.length} of {report.length} shown
            </span>
          </div>

          {/* ───────── Table ───────── */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-rule-soft bg-vellum/50">
                  {COLUMNS.map((column) => {
                    const sorted = column.sort && sort.key === column.sort;
                    return (
                      <th
                        key={column.label}
                        scope="col"
                        aria-sort={sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                        className="mono px-5 py-3 text-[10px] font-normal tracking-[0.08em] whitespace-nowrap text-ink-soft uppercase"
                      >
                        {column.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.sort!)}
                            className={`-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded border-none bg-transparent px-1.5 py-0.5 tracking-[inherit] uppercase transition-colors duration-150 hover:bg-vellum-2 hover:text-navy-deep ${
                              sorted ? "text-navy-deep" : "text-ink-soft"
                            }`}
                          >
                            {column.label}
                            <span
                              className={`transition-[transform,opacity] duration-200 ${sorted ? "opacity-100" : "opacity-30"} ${
                                sorted && sort.dir === "asc" ? "rotate-180" : ""
                              }`}
                            >
                              <Icon name="chevronDown" size={11} />
                            </span>
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Re-keyed on filter/sort so the rows replay their entrance, but not on every keystroke. */}
              <tbody key={`${filter}-${sort.key}-${sort.dir}`} className="divide-y divide-rule-soft">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length}>
                      <EmptyState icon="search" title="NO MATCHES">
                        Nothing in this roster matches your search or filter.
                      </EmptyState>
                    </td>
                  </tr>
                ) : (
                  visible.map((row, index) => (
                    <tr
                      key={row.user_id}
                      aria-busy={row.pending || undefined}
                      className={`group animate-fade-in transition-[background-color,opacity] duration-150 hover:bg-vellum/40 ${
                        row.status === "rejected" ? "bg-[#b3261e]/[0.025]" : ""
                      } ${row.pending ? "opacity-60" : ""}`}
                      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    >
                      <td className="px-5 py-4 shadow-[inset_3px_0_0_transparent] transition-shadow duration-150 group-hover:shadow-[inset_3px_0_0_var(--orange)]">
                        <span className="flex items-center gap-3">
                          <span className="mono flex size-9 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[11.5px] font-semibold text-navy-deep transition-colors duration-150 group-hover:bg-navy group-hover:text-paper">
                            <Initials first={row.first_name} last={row.last_name} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold whitespace-nowrap text-navy-deep">{rosterName(row)}</span>
                            <span className="mono block text-[11px] text-ink-soft">{row.student_id ?? "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                        <span className="block text-ink">{row.course ?? "—"}</span>
                        <span className="mono block text-[11px]">{row.year_level ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <AttendanceBadge status={row.status} />
                      </td>
                      <td className="px-5 py-4">
                        <span className="mono mb-1.5 block text-[11px] whitespace-nowrap text-ink">
                          {row.pending ? "Saving…" : <LocalTime value={row.recorded_at} format="short" />}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <MethodTag method={row.method} />
                          {row.recorded_by && (
                            <span className="text-[11.5px] whitespace-nowrap text-ink-soft">by {row.recorded_by}</span>
                          )}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-5 py-4 text-[12.5px] text-ink-soft italic [overflow-wrap:anywhere]">
                        {row.note || <span className="text-rule not-italic">—</span>}
                      </td>
                      <td className="py-3 pr-4 pl-2 text-right">
                        {!row.pending && (
                          <span className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => onRemove(row)}
                              className={ICON_BUTTON}
                              aria-label={`Remove ${rosterName(row)}'s record`}
                              title="Remove record"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Frame>
  );
}
