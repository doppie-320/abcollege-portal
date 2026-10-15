"use client";

import { checkInWindow, type AttendanceEvent } from "@/lib/attendance";
import { updateEventAttendance } from "../actions";
import ActionForm from "../ActionForm";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function EventSettings({ event }: { event: AttendanceEvent }) {
  const { opens, closes } = checkInWindow(event);

  return (
    <ActionForm action={updateEventAttendance}>
      <input type="hidden" name="eventId" value={event.event_id} />
      <p>
        <label>
          <input type="checkbox" name="takesAttendance" defaultChecked={event.takes_attendance} /> Takes attendance
        </label>
      </p>
      <p>
        <label>
          Check-in opens{" "}
          <input type="datetime-local" name="checkInOpensAt" defaultValue={toLocalInput(event.check_in_opens_at)} />
        </label>{" "}
        (blank = 30 minutes before the event starts)
      </p>
      <p>
        <label>
          Check-in closes{" "}
          <input type="datetime-local" name="checkInClosesAt" defaultValue={toLocalInput(event.check_in_closes_at)} />
        </label>{" "}
        (blank = when the event ends)
      </p>
      <p>
        Currently: {opens.toLocaleString()} – {closes.toLocaleString()}
      </p>
      <button type="submit">Save</button>
    </ActionForm>
  );
}
