"use client";

import { checkInWindow, type AttendanceEvent } from "@/lib/attendance";
import LocalTime, { useHydrated } from "@/app/attendance/LocalTime";
import { FIELD, FIELD_LABEL, Icon } from "@/app/attendance/ui";
import { updateEventAttendance } from "../actions";
import ActionForm from "../ActionForm";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export type AttendanceSettings = Pick<AttendanceEvent, "takes_attendance" | "check_in_opens_at" | "check_in_closes_at">;

/** `onSave` shows the new settings at once (see ActionForm's `optimistic`). */
export default function EventSettings({
  event,
  onSave,
}: {
  event: AttendanceEvent;
  onSave: (settings: AttendanceSettings) => void;
}) {
  const { opens, closes } = checkInWindow(event);
  // The server renders in its own time zone; remount the inputs once the browser's is known.
  const hydrated = useHydrated();

  return (
    <ActionForm
      action={updateEventAttendance}
      optimistic={(formData) =>
        onSave({
          takes_attendance: formData.get("takesAttendance") === "on",
          check_in_opens_at: (formData.get("checkInOpensAt") as string) || null,
          check_in_closes_at: (formData.get("checkInClosesAt") as string) || null,
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
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-rule transition-colors duration-200 peer-checked:bg-orange peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-paper after:shadow after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-5"
        />
      </label>

      <div className="grid grid-cols-1 gap-3" key={hydrated ? "local" : "server"}>
        <label className="m-0">
          <span className={FIELD_LABEL}>Check-in opens</span>
          <input
            type="datetime-local"
            name="checkInOpensAt"
            defaultValue={hydrated ? toLocalInput(event.check_in_opens_at) : ""}
            className={FIELD}
          />
          <span className="mt-1 block text-[11.5px] font-normal text-ink-soft">Blank = 30 minutes before the event starts.</span>
        </label>
        <label className="m-0">
          <span className={FIELD_LABEL}>Check-in closes</span>
          <input
            type="datetime-local"
            name="checkInClosesAt"
            defaultValue={hydrated ? toLocalInput(event.check_in_closes_at) : ""}
            className={FIELD}
          />
          <span className="mt-1 block text-[11.5px] font-normal text-ink-soft">Blank = when the event ends.</span>
        </label>
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

      <button type="submit" className="btn self-start rounded-lg px-4 py-2 text-[13px]">
        <Icon name="check" size={13} />
        Save settings
      </button>
    </ActionForm>
  );
}
