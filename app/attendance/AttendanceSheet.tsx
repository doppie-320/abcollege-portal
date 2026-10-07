"use client";

import { startTransition, useOptimistic, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";
import type { CalendarEntry } from "@/app/calendar/CalendarContent";
import { settle } from "@/lib/actionResult";
import { formatISODate, formatPeso } from "@/lib/dates";
import type { SheetEntry } from "@/lib/mock/portal-db";
import { markUnrecorded, saveAttendance, saveFineRates } from "./actions";
import {
  computeFine,
  normalizeEntry,
  validateRates,
  type AttendanceEntry,
  type AttendanceMark,
  type FineRates,
} from "./fines";

export type RosterStudent = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string;
};

type Change =
  | { type: "set"; userId: string; entry: AttendanceEntry | null }
  | { type: "mark-rest"; userIds: string[]; mark: AttendanceMark };

type Filter = "all" | "unrecorded" | AttendanceMark | "excused";

const MARKS: AttendanceMark[] = ["present", "late", "absent"];

const MARK_LABELS: Record<AttendanceMark, string> = { present: "Present", late: "Late", absent: "Absent" };

const MARK_ACTIVE: Record<AttendanceMark, string> = {
  present: "border-[#2f7a4f] bg-[#2f7a4f] text-paper",
  late: "border-[#b8860b] bg-[#b8860b] text-paper",
  absent: "border-orange bg-orange text-paper",
};

function applyChange(current: SheetEntry[], change: Change): SheetEntry[] {
  if (change.type === "set") {
    const rest = current.filter((e) => e.userId !== change.userId);
    return change.entry ? [...rest, { userId: change.userId, ...change.entry }] : rest;
  }
  const recorded = new Set(current.map((e) => e.userId));
  const added = change.userIds
    .filter((userId) => !recorded.has(userId))
    .map((userId) => ({ userId, mark: change.mark, excused: false, finePaid: false }));
  return [...current, ...added];
}

const SAVE_ERROR = "Couldn't save that change. Please try again.";

export default function AttendanceSheet({
  events,
  eventId,
  rates,
  entries,
  roster,
}: {
  // Newest first.
  events: CalendarEntry[];
  // null when there are no events yet.
  eventId: number | null;
  rates: FineRates;
  entries: SheetEntry[];
  roster: RosterStudent[];
}) {
  const router = useRouter();
  // Edits show right away; both reset to the server's data once it refreshes.
  const [entryList, apply] = useOptimistic(entries, applyChange);
  const [currentRates, applyRates] = useOptimistic(rates);
  const [rateDraft, setRateDraft] = useState({ late: String(rates.late), absent: String(rates.absent) });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  const byUser = new Map(entryList.map((e) => [e.userId, e]));

  const counts = { present: 0, late: 0, absent: 0, excused: 0, unrecorded: 0 };
  let totalFines = 0;
  let outstanding = 0;
  for (const student of roster) {
    const entry = byUser.get(student.id);
    if (!entry) {
      counts.unrecorded++;
      continue;
    }
    counts[entry.excused ? "excused" : entry.mark]++;
    const fine = computeFine(entry, currentRates);
    totalFines += fine;
    if (!entry.finePaid) outstanding += fine;
  }

  const q = query.trim().toLowerCase();
  const visible = roster.filter((student) => {
    if (q && !student.name.toLowerCase().includes(q)) return false;
    const entry = byUser.get(student.id);
    if (filter === "all") return true;
    if (filter === "unrecorded") return !entry;
    if (filter === "excused") return !!entry?.excused;
    return entry?.mark === filter && !entry.excused;
  });

  const draftRates: FineRates = { late: Number(rateDraft.late), absent: Number(rateDraft.absent) };
  const ratesChanged = draftRates.late !== currentRates.late || draftRates.absent !== currentRates.absent;

  function run(action: () => Promise<{ error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function update(userId: string, entry: AttendanceEntry | null) {
    if (eventId === null) return;
    const next = entry && normalizeEntry(entry);
    run(async () => {
      apply({ type: "set", userId, entry: next });
      return settle(saveAttendance(eventId, userId, next), SAVE_ERROR);
    });
  }

  function markRest(mark: AttendanceMark) {
    if (eventId === null) return;
    const userIds = roster.filter((s) => !byUser.has(s.id)).map((s) => s.id);
    run(async () => {
      apply({ type: "mark-rest", userIds, mark });
      return settle(markUnrecorded(eventId, userIds, mark), SAVE_ERROR);
    });
  }

  function saveRates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (eventId === null || !ratesChanged) return;
    const invalid = validateRates(draftRates);
    if (invalid) {
      setError(invalid);
      return;
    }
    run(async () => {
      applyRates(draftRates);
      return settle(saveFineRates(eventId, draftRates), "Couldn't save the fine rates. Please try again.");
    });
  }

  return (
    <section className="tick-frame mt-7 animate-fade-in-up [animation-delay:0.2s]">
      <span className="tick-bl" />
      <span className="tick-br" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2.5">
        <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">
          Attendance sheet <span className="text-ink-soft">· admins only</span>
        </span>
        {eventId !== null && (
          <div className="w-[320px] max-w-full">
            <Select
              value={String(eventId)}
              onChange={(v) => router.push(`/attendance?event=${v}`, { scroll: false })}
              options={events.map((e) => ({
                value: String(e.id),
                label: `${formatISODate(e.date, { month: "short", day: "numeric", year: "numeric" })} · ${e.name}`,
              }))}
              aria-label="Event to take attendance for"
              compact
            />
          </div>
        )}
      </div>

      {eventId === null ? (
        <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">
          There are no events on the calendar yet. Add one on the Calendar page to take attendance for it.
        </p>
      ) : (
        <>
          {/* ---------- Fine rates ---------- */}
          <form onSubmit={saveRates} noValidate className="mt-4 rounded-[6px] border border-rule-soft bg-vellum/50 px-3.5 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <RateInput
                id="lateRate"
                label="Late fine"
                value={rateDraft.late}
                onChange={(v) => setRateDraft((d) => ({ ...d, late: v }))}
              />
              <RateInput
                id="absentRate"
                label="Absent fine"
                value={rateDraft.absent}
                onChange={(v) => setRateDraft((d) => ({ ...d, absent: v }))}
              />
              <button type="submit" className="btn px-4 py-2 text-[13px]" disabled={!ratesChanged}>
                Save rates
              </button>
            </div>
            <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft">
              Fines are calculated from these rates. Saving updates every fine for this event, including ones
              already recorded. Excused marks are never fined.
            </p>
          </form>

          {/* ---------- Summary ---------- */}
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 font-mono text-[11.5px] text-ink-soft">
            <span>
              {counts.present} present · {counts.late} late · {counts.absent} absent · {counts.excused} excused ·{" "}
              {counts.unrecorded} not recorded
            </span>
            <span>
              Outstanding{" "}
              <strong className={outstanding > 0 ? "text-orange" : "text-navy-deep"}>{formatPeso(outstanding)}</strong> of{" "}
              {formatPeso(totalFines)}
            </span>
          </div>

          {/* ---------- Toolbar ---------- */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              aria-label="Search students"
              className="mb-0! max-w-[260px] flex-1 py-1.5! text-[13px]! shadow-none!"
            />
            <div className="w-[170px]">
              <Select
                value={filter}
                onChange={(v) => setFilter(v as Filter)}
                options={[
                  { value: "all", label: `Everyone (${roster.length})` },
                  { value: "unrecorded", label: `Not recorded (${counts.unrecorded})` },
                  { value: "present", label: `Present (${counts.present})` },
                  { value: "late", label: `Late (${counts.late})` },
                  { value: "absent", label: `Absent (${counts.absent})` },
                  { value: "excused", label: `Excused (${counts.excused})` },
                ]}
                aria-label="Filter students"
                compact
              />
            </div>
            {counts.unrecorded > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-soft">
                Mark the {counts.unrecorded} not recorded as
                <button type="button" className="btn ghost px-2.5 py-1 text-[12px]" onClick={() => markRest("present")}>
                  Present
                </button>
                <button type="button" className="btn ghost px-2.5 py-1 text-[12px]" onClick={() => markRest("absent")}>
                  Absent
                </button>
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 mb-0 text-[12.5px] text-[#b3261e]">
              {error}
            </p>
          )}

          {/* ---------- Students ---------- */}
          {roster.length === 0 ? (
            <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">No student accounts yet.</p>
          ) : visible.length === 0 ? (
            <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">No students match.</p>
          ) : (
            <ul className="mt-2 list-none">
              {visible.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  entry={byUser.get(student.id) ?? null}
                  rates={currentRates}
                  onChange={(entry) => update(student.id, entry)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RateInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 text-[12px]">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px] text-ink-soft">₱</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className="mb-0! w-[110px]! py-1.5! pl-6! text-[13px]!"
        />
      </div>
    </div>
  );
}

function StudentRow({
  student,
  entry,
  rates,
  onChange,
}: {
  student: RosterStudent;
  entry: AttendanceEntry | null;
  rates: FineRates;
  onChange: (entry: AttendanceEntry | null) => void;
}) {
  const fine = entry ? computeFine(entry, rates) : 0;
  const canExcuse = entry !== null && entry.mark !== "present";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-soft py-2.5 last:border-b-0 last:pb-0">
      <span className="flex min-w-[170px] flex-1 items-center gap-2.5">
        {student.avatarUrl ? (
          <Image
            src={student.avatarUrl}
            alt=""
            width={30}
            height={30}
            className="size-[30px] shrink-0 rounded-full border border-navy-tint object-cover"
          />
        ) : (
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-navy-tint bg-blue font-display text-[11px] font-semibold text-paper">
            {student.initials}
          </span>
        )}
        <span className="min-w-0 truncate text-[13.5px] font-medium">{student.name}</span>
      </span>

      <span className="inline-flex" role="group" aria-label={`${student.name}'s attendance`}>
        {MARKS.map((mark, i) => {
          const active = entry?.mark === mark;
          return (
            <button
              key={mark}
              type="button"
              aria-pressed={active}
              title={active ? "Click again to clear" : undefined}
              // Changing the mark starts fresh: a new fine, not excused, not paid.
              onClick={() => onChange(active ? null : { mark, excused: false, finePaid: false })}
              className={[
                "cursor-pointer border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.04em] transition-colors",
                i === 0 ? "rounded-l-[4px]" : "-ml-px",
                i === MARKS.length - 1 ? "rounded-r-[4px]" : "",
                active ? MARK_ACTIVE[mark] : "border-rule bg-paper text-ink-soft hover:text-ink",
              ].join(" ")}
            >
              {MARK_LABELS[mark]}
            </button>
          );
        })}
      </span>

      <button
        type="button"
        aria-pressed={entry?.excused ?? false}
        disabled={!canExcuse}
        title="Waive the fine but keep the late or absent mark"
        onClick={() => entry && onChange({ ...entry, excused: !entry.excused })}
        className={[
          "cursor-pointer rounded-[4px] border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.04em] transition-colors disabled:cursor-default disabled:opacity-40",
          entry?.excused ? "border-blue bg-blue text-paper" : "border-rule bg-paper text-ink-soft enabled:hover:text-ink",
        ].join(" ")}
      >
        {entry?.excused ? "Excused" : "Excuse"}
      </button>

      <span className="w-[84px] text-right text-[13px] whitespace-nowrap">
        {entry?.excused && entry.mark !== "present" ? (
          <span className="text-ink-soft line-through">{formatPeso(rates[entry.mark])}</span>
        ) : fine > 0 ? (
          <span className={entry?.finePaid ? "text-ink-soft line-through" : "font-semibold text-orange"}>
            {formatPeso(fine)}
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        )}
      </span>

      <span className="w-[58px]">
        {entry && fine > 0 && (
          <label className="mb-0 flex cursor-pointer items-center gap-1.5 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={entry.finePaid}
              onChange={(e) => onChange({ ...entry, finePaid: e.target.checked })}
              className="size-4 accent-navy"
            />
            Paid
          </label>
        )}
      </span>
    </li>
  );
}
