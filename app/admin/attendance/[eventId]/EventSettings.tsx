"use client";

import { useState } from "react";
import { checkInWindow, type AttendanceEvent } from "@/lib/attendance";
import LocalTime, { useHydrated } from "@/app/attendance/LocalTime";
import { FIELD_LABEL, Icon } from "@/app/attendance/ui";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { updateEventAttendance } from "../actions";
import ActionForm from "../ActionForm";

// Same pickers as the calendar's event modal: scroll wheels on phones and tablets.
const WHEEL_QUERY = "(max-width: 1024px), (orientation: portrait)";

// The pickers want "YYYY-MM-DD" and "HH:mm" in local time.
function toLocalParts(date: Date): { day: string; time: string } {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return { day: local.slice(0, 10), time: local.slice(11, 16) };
}

/**
 * A date and time sent as one ISO string, or blank to use the default. The time
 * starts at `fallback`'s so picking only a date keeps the default window's time.
 */
function DateTimeField({
  name,
  label,
  hint,
  value,
  fallback,
  baseYear,
}: {
  name: string;
  label: string;
  hint: string;
  value: string | null;
  fallback: Date;
  baseYear: number;
}) {
  const [day, setDay] = useState(() => (value ? toLocalParts(new Date(value)).day : ""));
  const [time, setTime] = useState(() => toLocalParts(value ? new Date(value) : fallback).time);
  const labelId = `${name}Label`;

  return (
    <div>
      <span className={FIELD_LABEL} id={labelId}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className={`grid gap-2.5 ${day ? "grid-cols-[minmax(0,1fr)_124px] sm:grid-cols-[minmax(0,1fr)_136px]" : "grid-cols-1"}`}
      >
        <DatePicker
          value={day}
          onChange={setDay}
          placeholder="Default"
          minYear={baseYear - 2}
          maxYear={baseYear + 5}
          modalQuery={WHEEL_QUERY}
        />
        {day && <TimePicker value={time} onChange={setTime} aria-label={`${label} time`} modalQuery={WHEEL_QUERY} />}
      </div>
      <input type="hidden" name={name} value={day ? new Date(`${day}T${time}`).toISOString() : ""} />
      <span className="mt-1 block text-[11.5px] font-normal text-ink-soft">{hint}</span>
    </div>
  );
}

export type AttendanceSettings = Pick<
  AttendanceEvent,
  "takes_attendance" | "check_in_opens_at" | "check_in_closes_at" | "accepts_static_pass"
>;

const SWITCH =
  "relative h-6 w-11 shrink-0 rounded-full bg-rule transition-colors duration-200 peer-checked:bg-orange peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-paper after:shadow after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-5";

/** `onSave` shows the new settings at once (see ActionForm's `optimistic`). */
export default function EventSettings({
  event,
  onSave,
}: {
  event: AttendanceEvent;
  onSave: (settings: AttendanceSettings) => void;
}) {
  const { opens, closes } = checkInWindow(event);
  const hydrated = useHydrated();
  // Keeps the picker's year list around the event rather than capping it at this year.
  const baseYear = new Date(event.event_start).getFullYear();

  return (
    <ActionForm
      action={updateEventAttendance}
      optimistic={(formData) =>
        onSave({
          takes_attendance: formData.get("takesAttendance") === "on",
          check_in_opens_at: (formData.get("checkInOpensAt") as string) || null,
          check_in_closes_at: (formData.get("checkInClosesAt") as string) || null,
          accepts_static_pass: formData.get("acceptsStaticPass") === "on",
        })
      }
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="eventId" value={event.event_id} />

      <label className="m-0 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-rule bg-vellum/40 px-3.5 py-3">
        <span>
          <span className="block text-[13.5px] font-semibold text-navy-deep">Takes attendance</span>
          <span className="block text-[12px] font-normal text-ink-soft">Lets scanners check students in.</span>
        </span>
        <input type="checkbox" name="takesAttendance" defaultChecked={event.takes_attendance} className="peer sr-only" />
        <span aria-hidden="true" className={SWITCH} />
      </label>

      <label className="m-0 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-rule bg-vellum/40 px-3.5 py-3">
        <span>
          <span className="block text-[13.5px] font-semibold text-navy-deep">Accept static passes</span>
          <span className="block text-[12px] font-normal text-ink-soft">
            Takes the student&apos;s main pass, which never changes. Turn off to require the live code from their phone,
            which screenshots and printouts can&apos;t copy.
          </span>
        </span>
        <input
          type="checkbox"
          name="acceptsStaticPass"
          defaultChecked={event.accepts_static_pass}
          className="peer sr-only"
        />
        <span aria-hidden="true" className={SWITCH} />
      </label>

      {/* Remounted once hydrated so the fields start from the browser's time zone, not the server's. */}
      <div className="grid grid-cols-1 gap-3" key={hydrated ? "local" : "server"}>
        <DateTimeField
          name="checkInOpensAt"
          label="Check-in opens"
          hint="Blank = 30 minutes before the event starts."
          value={hydrated ? event.check_in_opens_at : null}
          fallback={opens}
          baseYear={baseYear}
        />
        <DateTimeField
          name="checkInClosesAt"
          label="Check-in closes"
          hint="Blank = when the event ends."
          value={hydrated ? event.check_in_closes_at : null}
          fallback={closes}
          baseYear={baseYear}
        />
      </div>

      <div className="rounded-lg border border-dashed border-navy/30 bg-[#e6f3ff]/60 px-3.5 py-2.5">
        <span className="mono mb-1 flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-blue uppercase">
          <Icon name="clock" size={11} />
          Current window
        </span>
        <p className="mb-0 text-[12.5px] font-medium text-navy-deep">
          <LocalTime value={opens} format="short" /> &rarr; <LocalTime value={closes} format="short" />
        </p>
      </div>

      <button type="submit" className="btn self-end rounded-lg px-4 py-2 text-[13px]">
        <Icon name="check" size={13} />
        Save settings
      </button>
    </ActionForm>
  );
}
