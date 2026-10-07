"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/components/NavigationHeader";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import PostMenu from "@/app/home/PostMenu";
import type { Viewer } from "@/lib/auth";
import { MONTH_NAMES, formatISODate, toISODate } from "@/lib/dates";
import { deleteEvent } from "./actions";
import EventFormModal from "./EventFormModal";

export type CalendarEntry = {
  id: number;
  name: string;
  // YYYY-MM-DD
  date: string;
  description: string;
  kind: "event" | "holiday";
};

export type Celebrant = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string;
  day: number;
};

type CalendarContentProps = {
  viewer: Viewer;
  year: number;
  // 0-based, like Date#getMonth.
  monthIndex: number;
  // YYYY-MM-DD in school time.
  today: string;
  entries: CalendarEntry[];
  celebrants: Celebrant[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Labels shown inside a day cell before collapsing the rest into "+N more".
const MAX_CELL_LABELS = 2;

function monthParam(year: number, monthIndex: number) {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Modal =
  | { type: "create"; date: string }
  | { type: "edit"; entry: CalendarEntry }
  | { type: "delete"; entry: CalendarEntry };

export default function CalendarContent({
  viewer,
  year,
  monthIndex,
  today,
  entries,
  celebrants,
}: CalendarContentProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);

  const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
  const isCurrentMonth = today.startsWith(monthParam(year, monthIndex));
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = new Date(year, monthIndex, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const entriesByDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    entriesByDate.set(entry.date, [...(entriesByDate.get(entry.date) ?? []), entry]);
  }

  const birthdayDays = new Set(celebrants.map((c) => c.day));
  const eventCount = entries.filter((e) => e.kind === "event").length;
  const holidayCount = entries.length - eventCount;

  const visibleEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : entries;

  function toggleDay(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
  }

  return (
    <>
      <SiteNav
        initials={viewer.initials}
        name={viewer.name}
        userId={viewer.id}
        avatarUrl={viewer.avatarUrl}
      />

      <div className="page-wrap">
        <div className="mb-6 animate-fade-in-up">
          <span className="eyebrow mb-2 tracking-[0.08em]">SOE HUB / CALENDAR</span>
          <h1 className="mb-1 text-[30px] leading-none">School Calendar</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Council events, holidays, and this month&apos;s birthday celebrants.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_340px] items-start gap-7 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            {/* ---------- Month grid ---------- */}
            <section className="tick-frame mb-5 animate-fade-in-up [animation-delay:0.04s] max-[560px]:px-3">
              <span className="tick-bl" />
              <span className="tick-br" />

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="mb-0 text-[22px]" aria-live="polite">
                  {monthLabel}
                </h2>
                <div className="flex items-center gap-1.5">
                  {!isCurrentMonth && (
                    <Link href="/calendar" className="btn ghost mr-1 px-3 py-1.5 text-[13px]">
                      Today
                    </Link>
                  )}
                  <Link
                    href={`/calendar?month=${monthParam(year, monthIndex - 1)}`}
                    className="btn ghost size-9 p-0"
                    aria-label="Previous month"
                  >
                    <ChevronIcon direction="left" />
                  </Link>
                  <Link
                    href={`/calendar?month=${monthParam(year, monthIndex + 1)}`}
                    className="btn ghost size-9 p-0"
                    aria-label="Next month"
                  >
                    <ChevronIcon direction="right" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAYS.map((w) => (
                  <span
                    key={w}
                    className="pb-1 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-soft"
                  >
                    {w}
                  </span>
                ))}

                {cells.map((day, i) => {
                  if (day === null) {
                    return <span key={`blank-${i}`} aria-hidden className="min-h-12 sm:min-h-[84px]" />;
                  }

                  const date = toISODate(year, monthIndex, day);
                  const dayEntries = entriesByDate.get(date) ?? [];
                  const hasHoliday = dayEntries.some((e) => e.kind === "holiday");
                  const hasEvent = dayEntries.some((e) => e.kind === "event");
                  const hasBirthday = birthdayDays.has(day);
                  const isToday = date === today;
                  const isSelected = date === selectedDate;

                  const summary = [
                    ...dayEntries.map((e) => (e.kind === "holiday" ? `Holiday: ${e.name}` : e.name)),
                    ...(hasBirthday ? ["Birthday celebrant"] : []),
                  ].join(", ");

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleDay(date)}
                      aria-pressed={isSelected}
                      aria-label={`${formatISODate(date, { weekday: "long", month: "long", day: "numeric" })}${summary ? ` — ${summary}` : ""}`}
                      title={summary || undefined}
                      className={[
                        "relative flex min-h-12 flex-col items-stretch rounded-[5px] border p-1 text-left transition-[border-color,background,box-shadow] duration-150 sm:min-h-[84px] sm:p-1.5",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue",
                        hasHoliday
                          ? "border-orange/40 bg-[#fcebdf]"
                          : hasEvent
                            ? "border-navy-tint bg-[#e8eef6]"
                            : "border-rule-soft bg-paper",
                        isSelected
                          ? "border-navy! shadow-[2px_2px_0_var(--orange),4px_4px_0_var(--yellow)]"
                          : "hover:border-navy/60",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={[
                            "flex size-6 items-center justify-center rounded-full font-mono text-[12px] leading-none",
                            isToday ? "bg-navy font-semibold text-paper" : hasHoliday ? "text-orange" : "text-ink",
                          ].join(" ")}
                        >
                          {day}
                        </span>
                        {hasBirthday && (
                          <span className="text-[#b8860b]" aria-hidden>
                            <CakeIcon />
                          </span>
                        )}
                      </span>

                      {/* Full labels on wider screens; colored dots on phones. */}
                      <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
                        {dayEntries.slice(0, MAX_CELL_LABELS).map((e) => (
                          <span
                            key={e.id}
                            className={[
                              "truncate rounded-[3px] px-1 py-px text-[10.5px] font-medium leading-tight",
                              e.kind === "holiday" ? "bg-orange text-paper" : "bg-navy text-paper",
                            ].join(" ")}
                          >
                            {e.name}
                          </span>
                        ))}
                        {dayEntries.length > MAX_CELL_LABELS && (
                          <span className="px-1 font-mono text-[10px] text-ink-soft">
                            +{dayEntries.length - MAX_CELL_LABELS} more
                          </span>
                        )}
                      </span>
                      {dayEntries.length > 0 && (
                        <span className="mt-auto flex gap-0.5 sm:hidden" aria-hidden>
                          {hasEvent && <span className="size-1.5 rounded-full bg-navy" />}
                          {hasHoliday && <span className="size-1.5 rounded-full bg-orange" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule-soft pt-3 font-mono text-[11px] text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-navy" /> Event
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-orange" /> Holiday
                </span>
                <span className="flex items-center gap-1.5 text-[#b8860b]">
                  <CakeIcon /> <span className="text-ink-soft">Birthday</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-navy text-[8px] text-paper">
                    {Number(today.slice(8))}
                  </span>
                  Today
                </span>
              </div>
            </section>

            {/* ---------- This month's events ---------- */}
            <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
              <span className="tick-bl" />
              <span className="tick-br" />

              <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">
                  {selectedDate
                    ? formatISODate(selectedDate, { weekday: "long", month: "long", day: "numeric" })
                    : "This month's events"}
                </span>
                <span className="flex items-center gap-3">
                  {selectedDate ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="cursor-pointer font-mono text-[11px] text-blue hover:text-navy hover:underline"
                    >
                      Show whole month
                    </button>
                  ) : (
                    <span className="mono text-[11px] text-ink-soft">
                      {eventCount} event{eventCount === 1 ? "" : "s"} · {holidayCount} holiday
                      {holidayCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </div>

              {visibleEntries.length === 0 ? (
                <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">
                  {selectedDate ? "Nothing scheduled on this day." : `Nothing on the calendar for ${monthLabel} yet.`}
                </p>
              ) : (
                <ul className="list-none">
                  {visibleEntries.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 border-b border-rule-soft py-3 last:border-b-0 last:pb-0">
                      <span
                        className={[
                          "mt-[7px] size-2 shrink-0 rounded-full",
                          entry.kind === "holiday" ? "bg-orange" : "bg-navy",
                        ].join(" ")}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[12px] text-ink-soft">
                            {formatISODate(entry.date, { month: "short", day: "numeric", weekday: "short" })}
                          </span>
                          <strong className="text-[14.5px] font-semibold text-ink [overflow-wrap:anywhere]">
                            {entry.name}
                          </strong>
                          {entry.kind === "holiday" && <span className="tag orange">HOLIDAY</span>}
                        </div>
                        {entry.description && (
                          <p className="mt-0.5 mb-0 whitespace-pre-line text-[13px] text-ink-soft [overflow-wrap:anywhere]">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      {viewer.isAdmin && (
                        <PostMenu
                          noun="entry"
                          onEdit={() => setModal({ type: "edit", entry })}
                          onDelete={() => setModal({ type: "delete", entry })}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {viewer.isAdmin && (
                <button
                  type="button"
                  className="btn mt-4 w-full gap-1.5 py-2 text-[13px]"
                  onClick={() =>
                    setModal({
                      type: "create",
                      date: selectedDate ?? (isCurrentMonth ? today : toISODate(year, monthIndex, 1)),
                    })
                  }
                >
                  <PlusIcon />
                  {selectedDate
                    ? `Add an entry on ${formatISODate(selectedDate, { month: "short", day: "numeric" })}`
                    : "Add an event or holiday"}
                </button>
              )}
            </section>
          </div>

          {/* ---------- Birthday celebrants ---------- */}
          <aside className="tick-frame animate-fade-in-up [animation-delay:0.12s]">
            <span className="tick-bl" />
            <span className="tick-br" />
            <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
              <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">
                Birthday celebrants
              </span>
              <span className="mono text-[11px] text-ink-soft">{MONTH_NAMES[monthIndex]}</span>
            </div>

            {celebrants.length === 0 ? (
              <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">
                No shared birthdays in {MONTH_NAMES[monthIndex]}.
              </p>
            ) : (
              <ul className="list-none">
                {celebrants.map((c) => {
                  const isToday = isCurrentMonth && Number(today.slice(8)) === c.day;
                  return (
                    <li key={c.id} className="flex items-center gap-3 border-b border-rule-soft py-2.5 last:border-b-0 last:pb-0">
                      {c.avatarUrl ? (
                        <Image
                          src={c.avatarUrl}
                          alt=""
                          width={34}
                          height={34}
                          className="size-[34px] shrink-0 rounded-full border border-navy-tint object-cover"
                        />
                      ) : (
                        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-navy-tint bg-blue font-display text-[12px] font-semibold text-paper">
                          {c.initials}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c.name}</span>
                      {isToday ? (
                        <span className="tag orange shrink-0">TODAY</span>
                      ) : (
                        <span className="shrink-0 font-mono text-[12px] text-ink-soft">
                          {MONTH_NAMES[monthIndex].slice(0, 3)} {c.day}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-4 mb-0 border-t border-dashed border-rule pt-3 text-[11.5px] leading-snug text-ink-soft">
              Only students who chose to share their birthday at sign-up are listed.
            </p>
          </aside>
        </div>
      </div>

      {(modal?.type === "create" || modal?.type === "edit") && (
        <EventFormModal
          key={modal.type === "edit" ? modal.entry.id : modal.date}
          entry={modal.type === "edit" ? modal.entry : undefined}
          defaultDate={modal.type === "create" ? modal.date : modal.entry.date}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "delete" && (
        <ConfirmDialog
          title="Delete this entry?"
          message={
            <>
              <strong>{modal.entry.name}</strong> will be removed from the calendar for everyone.
            </>
          }
          confirmLabel="Delete"
          busyLabel="Deleting…"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            const result = await deleteEvent(modal.entry.id);
            if (result.error) return result.error;
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

function CakeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
