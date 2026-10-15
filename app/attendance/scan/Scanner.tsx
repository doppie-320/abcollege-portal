"use client";

import { useState, useTransition, type FormEvent } from "react";
import { checkInState, checkInWindow, type AttendanceEvent, type AttendanceStatus, type ScannedStudent } from "@/lib/attendance";
import { lookupScan, recordScan } from "../actions";

// Takes the token as pasted text for now. A camera reader (e.g. the
// `html5-qrcode` package) only needs to pass what it decodes to lookupScan().
export default function Scanner({ events }: { events: AttendanceEvent[] }) {
  const [eventId, setEventId] = useState(events[0].event_id);
  const [token, setToken] = useState("");
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const event = events.find((e) => e.event_id === eventId) ?? events[0];
  const { opens, closes } = checkInWindow(event);

  function reset() {
    setToken("");
    setStudent(null);
  }

  function lookup(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await lookupScan(eventId, token);
      if (result.error !== undefined) {
        setStudent(null);
        setMessage(result.error);
        return;
      }
      setStudent(result.data);
      setMessage("");
    });
  }

  function decide(decision: AttendanceStatus) {
    startTransition(async () => {
      const result = await recordScan(eventId, token, decision);
      if (result.error !== undefined) {
        setMessage(result.error);
        return;
      }
      const name = `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim();
      setMessage(
        decision === "rejected" && result.data.status === "present"
          ? `${name} was already marked present, so the record was kept.`
          : `${name}: ${result.data.status}.`,
      );
      reset();
    });
  }

  return (
    <div>
      <p>
        <label>
          Event{" "}
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(Number(e.target.value));
              reset();
              setMessage("");
            }}
          >
            {events.map((e) => (
              <option key={e.event_id} value={e.event_id}>{e.event_name}</option>
            ))}
          </select>
        </label>
      </p>
      <p>
        Check-in: {checkInState(event)} ({opens.toLocaleString()} – {closes.toLocaleString()})
      </p>

      <form onSubmit={lookup}>
        <label>
          Student code{" "}
          <input value={token} onChange={(e) => setToken(e.target.value)} size={60} required autoFocus />
        </label>{" "}
        <button type="submit" disabled={pending}>Look up</button>
      </form>

      {message && <p role="status">{message}</p>}

      {student && (
        <section>
          <h2>Is this the person in front of you?</h2>
          {student.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.avatarUrl} alt="" width={160} height={160} />
          ) : (
            <p>(No photo on file. Check their school ID.)</p>
          )}
          <dl>
            <dt>Name</dt>
            <dd>{student.first_name} {student.last_name}</dd>
            <dt>Student ID</dt>
            <dd>{student.student_id}</dd>
            <dt>Course / year</dt>
            <dd>{student.course ?? "—"} / {student.year_level ?? "—"}</dd>
            <dt>Current status</dt>
            <dd>
              {student.status
                ? `${student.status} (${new Date(student.recorded_at!).toLocaleTimeString()})`
                : "not recorded"}
            </dd>
          </dl>
          <button type="button" disabled={pending} onClick={() => decide("present")}>Accept</button>{" "}
          <button type="button" disabled={pending} onClick={() => decide("rejected")}>Reject</button>{" "}
          <button type="button" disabled={pending} onClick={reset}>Cancel</button>
        </section>
      )}
    </div>
  );
}
