"use client";

import type { MyAttendanceRow } from "@/lib/attendance-server";
import LocalTime, { useHydrated } from "./LocalTime";
import { AttendanceBadge, DateChip, MethodTag } from "./ui";

type MonthGroup = { key: string; label: string; rows: MyAttendanceRow[] };

/**
 * Groups rows (newest first) by the month they were recorded. Until the page
 * hydrates this uses UTC so the server and browser agree, then switches to
 * the viewer's own time zone.
 */
function groupByMonth(rows: MyAttendanceRow[], local: boolean): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const row of rows) {
    const date = new Date(row.recorded_at);
    const key = local ? `${date.getFullYear()}-${date.getMonth()}` : `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = {
        key,
        label: date.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: local ? undefined : "UTC" }),
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

export default function HistoryList({ history }: { history: MyAttendanceRow[] }) {
  const hydrated = useHydrated();
  const groups = groupByMonth(history, hydrated);
  let index = 0;

  return (
    <div className="border-t border-rule-soft">
      {groups.map((group) => (
        <section key={group.key}>
          {/* Sticks just under the nav bar while its month scrolls past. */}
          <h3 className="mono sticky top-[var(--nav-offset,0px)] z-[1] mb-0 flex items-center justify-between border-b border-rule-soft bg-vellum/85 px-5 py-1.5 text-[10px] font-normal tracking-[0.1em] text-ink-soft uppercase backdrop-blur-sm transition-[top] duration-250">
            <span>{group.label}</span>
            <span className="tabular-nums">
              {group.rows.filter((row) => row.status === "present").length}/{group.rows.length} present
            </span>
          </h3>
          <ul className="m-0 list-none divide-y divide-rule-soft">
            {group.rows.map((row) => (
              <li
                key={`${row.event_name}-${row.recorded_at}`}
                className="group animate-fade-in-up flex items-center gap-3.5 px-5 py-3.5 shadow-[inset_3px_0_0_transparent] transition-[background-color,box-shadow] duration-150 hover:bg-vellum/40 hover:shadow-[inset_3px_0_0_var(--orange)]"
                style={{ animationDelay: `${Math.min(index++, 10) * 35}ms` }}
              >
                <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-rotate-3">
                  <DateChip value={row.event_start} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 truncate text-[14px] font-semibold text-navy-deep">{row.event_name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="mono text-[11px] text-ink-soft">
                      <LocalTime value={row.recorded_at} format="short" />
                    </span>
                    <MethodTag method={row.method} />
                  </div>
                  {row.note && (
                    <p className="mt-1.5 mb-0 border-l-2 border-orange/60 pl-2 text-[12px] text-ink-soft italic">{row.note}</p>
                  )}
                </div>
                <AttendanceBadge status={row.status} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
