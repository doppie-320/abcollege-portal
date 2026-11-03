"use client";

import { useEffect, useRef } from "react";
import type { AttendanceHistoryEntry, AttendanceStatus } from "@/lib/attendance";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import LocalTime from "@/app/attendance/LocalTime";
import { AttendanceBadge, EmptyState, Icon, MethodTag, PersonChip, type IconName } from "@/app/attendance/ui";
import type { RosterRow } from "./RosterTable";

const STATUS_DOT: Record<AttendanceStatus, string> = { present: "bg-blue", rejected: "bg-[#b3261e]" };

function describe(entry: AttendanceHistoryEntry): { title: string; icon: IconName; dot: string } {
  if (entry.action === "removed") return { title: "Record removed", icon: "trash", dot: "bg-ink-soft" };
  const status = entry.status ?? "present";
  if (entry.action === "changed") {
    return { title: `Changed to ${status}`, icon: "history", dot: "bg-orange" };
  }
  if (entry.previous_status) return { title: `Recorded again as ${status}`, icon: "history", dot: STATUS_DOT[status] };
  return { title: status === "present" ? "Checked in" : "Rejected", icon: status === "present" ? "check" : "x", dot: STATUS_DOT[status] };
}

/** A roster student's full history for the event, newest first. */
export default function HistoryDialog({
  row,
  name,
  entries,
  eventName,
  onClose,
}: {
  row: RosterRow;
  name: string;
  entries: AttendanceHistoryEntry[];
  eventName: string;
  onClose: () => void;
}) {
  const backdrop = useBackdropDismiss(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  const changes = entries.filter((entry) => entry.action === "changed").length;

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(13,30,56,0.55)] backdrop-blur-[2px] sm:items-center sm:p-6"
      {...backdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-heading"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-t-lg border border-rule bg-paper shadow-[0_24px_60px_rgba(13,30,56,0.35)] sm:max-h-[min(720px,100%)] sm:rounded-lg"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-orange bg-navy py-2.5 pr-3 pl-[18px]">
          <span className="mono min-w-0 truncate text-[11.5px] tracking-[0.08em] text-navy-tint">
            ATTENDANCE HISTORY / {eventName.toUpperCase()}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex shrink-0 cursor-pointer rounded border-none bg-white/[0.12] p-[5px] text-paper transition-colors duration-150 hover:bg-white/[0.24] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-grid"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="h-[3px] shrink-0 bg-yellow" aria-hidden="true" />

        <div className="shrink-0 px-5 pt-5">
          <h2 id="history-heading" className="mb-0 text-[19px] leading-tight">
            {name}
          </h2>
          <p className="mono mt-1 mb-0 text-[11px] text-ink-soft">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {changes > 0 && (
              <>
                {" "}
                &middot; status changed {changes} {changes === 1 ? "time" : "times"}
              </>
            )}
          </p>
          <PersonChip
            first={row.first_name}
            last={row.last_name}
            detail={[row.student_id, row.course, row.year_level].filter(Boolean).join(" · ") || "—"}
            aside={<AttendanceBadge status={row.status} />}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5">
          {entries.length === 0 ? (
            <EmptyState icon="history" title="NO HISTORY YET">
              Changes to this record will show up here.
            </EmptyState>
          ) : (
            <ol className="relative m-0 list-none p-0">
              {/* The timeline's spine, behind the dots. */}
              <span aria-hidden="true" className="absolute top-2 bottom-2 left-[11px] w-px bg-rule" />
              {entries.map((entry, index) => {
                const { title, icon, dot } = describe(entry);
                return (
                  <li
                    key={entry.id}
                    className="animate-fade-in-up relative flex gap-3 pb-4 last:pb-0"
                    style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                  >
                    <span
                      className={`relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-paper text-paper ${dot} ${
                        index === 0 ? "ring-2 ring-navy/15" : ""
                      }`}
                    >
                      <Icon name={icon} size={11} />
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg border border-rule-soft bg-vellum/30 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13.5px] font-semibold text-navy-deep">{title}</span>
                        {index === 0 && entry.action !== "removed" && (
                          <span className="mono rounded bg-navy px-1.5 py-px text-[9.5px] tracking-[0.06em] text-paper">
                            CURRENT
                          </span>
                        )}
                      </div>
                      {entry.action === "changed" && entry.previous_status && entry.status && (
                        <span className="mt-1.5 flex items-center gap-1.5">
                          <AttendanceBadge status={entry.previous_status} />
                          <span className="text-ink-soft">
                            <Icon name="arrowRight" size={12} />
                          </span>
                          <AttendanceBadge status={entry.status} />
                        </span>
                      )}
                      {entry.action === "removed" && entry.previous_status && (
                        <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                          Was <AttendanceBadge status={entry.previous_status} />
                        </span>
                      )}
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="mono text-[11px] text-ink">
                          <LocalTime value={entry.happened_at} format="datetime" />
                        </span>
                        {entry.method && <MethodTag method={entry.method} />}
                        {entry.actor && <span className="text-[11.5px] text-ink-soft">by {entry.actor}</span>}
                      </span>
                      {entry.note && (
                        <p className="mt-1.5 mb-0 border-l-2 border-orange/60 pl-2 text-[12px] text-ink-soft italic [overflow-wrap:anywhere]">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-rule bg-vellum px-5 py-3">
          <button type="button" className="btn ghost rounded-lg px-4 py-2 text-[13px]" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
