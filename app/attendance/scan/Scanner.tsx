"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { checkInState, checkInWindow, type AttendanceEvent, type AttendanceStatus, type ScannedStudent } from "@/lib/attendance";
import { lookupScan, recordScan } from "../actions";
import CameraReader from "./CameraReader";

export default function Scanner({ events }: { events: AttendanceEvent[] }) {
  const [eventId, setEventId] = useState(events[0].event_id);
  const [cameraOn, setCameraOn] = useState(false);
  const [pasted, setPasted] = useState("");
  // The token currently on screen; recordScan() needs it again.
  const [token, setToken] = useState("");
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  // The camera reports the same code ~10 times a second; act on each one once,
  // and not while a lookup or decision is in flight.
  const busyRef = useRef(false);
  const handledRef = useRef("");

  const event = events.find((e) => e.event_id === eventId) ?? events[0];
  const { opens, closes } = checkInWindow(event);

  function reset() {
    setToken("");
    setStudent(null);
  }

  function lookup(text: string) {
    const scanned = text.trim();
    if (!scanned || busyRef.current) return;
    busyRef.current = true;
    handledRef.current = scanned;

    startTransition(async () => {
      try {
        const result = await lookupScan(eventId, scanned);
        if (result.error !== undefined) {
          reset();
          setNotice({ text: result.error, isError: true });
          return;
        }
        setToken(scanned);
        setStudent(result.data);
        setNotice(null);
      } finally {
        busyRef.current = false;
      }
    });
  }

  function onCameraRead(text: string) {
    if (student || text.trim() === handledRef.current) return;
    lookup(text);
  }

  function onPastedSubmit(e: FormEvent) {
    e.preventDefault();
    lookup(pasted);
    setPasted("");
  }

  function decide(decision: AttendanceStatus) {
    busyRef.current = true;
    startTransition(async () => {
      try {
        const result = await recordScan(eventId, token, decision);
        if (result.error !== undefined) {
          setNotice({ text: result.error, isError: true });
          return;
        }
        const name = `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim();
        setNotice({
          text:
            decision === "rejected" && result.data.status === "present"
              ? `${name} was already marked present, so the record was kept.`
              : `${name}: ${result.data.status}. Ready for the next student.`,
          isError: false,
        });
        reset();
      } finally {
        busyRef.current = false;
      }
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
              setNotice(null);
              handledRef.current = "";
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

      <p>
        <button
          type="button"
          onClick={() => {
            setCameraOn((on) => !on);
            setNotice(null);
          }}
        >
          {cameraOn ? "Stop camera" : "Start camera"}
        </button>
      </p>
      {cameraOn && (
        <CameraReader
          active={cameraOn}
          onRead={onCameraRead}
          onError={(text) => {
            setCameraOn(false);
            setNotice({ text, isError: true });
          }}
        />
      )}

      {notice && <p role={notice.isError ? "alert" : "status"}>{notice.text}</p>}

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

      <details>
        <summary>No camera? Paste a code instead</summary>
        <form onSubmit={onPastedSubmit}>
          <label>
            Student code <input value={pasted} onChange={(e) => setPasted(e.target.value)} size={60} required />
          </label>{" "}
          <button type="submit" disabled={pending}>Look up</button>
        </form>
      </details>
    </div>
  );
}
