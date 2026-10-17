"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Select from "@/components/Select";
import { checkInState, checkInWindow, type AttendanceEvent, type AttendanceStatus, type ScannedStudent } from "@/lib/attendance";
import { lookupScan, recordScan } from "../actions";
import LocalTime from "../LocalTime";
import {
  AttendanceBadge,
  BLUEPRINT_GRID,
  CheckInBadge,
  DANGER_BTN,
  EmptyState,
  FIELD,
  FIELD_LABEL,
  Frame,
  Icon,
  Initials,
  PanelHeader,
  StatStrip,
  type IconName,
} from "../ui";
import CameraReader from "./CameraReader";

type Notice = { text: string; isError: boolean };

/** A decision made on this device, for the session log. Not persisted. */
type LogEntry = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  studentId: string;
  eventName: string;
  status: AttendanceStatus;
  at: string;
};

function fullName(student: Pick<ScannedStudent, "first_name" | "last_name">): string {
  return `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
}

const STEPS = [
  "Pick the event you're checking students into.",
  "Start the camera and frame the student's pass.",
  "Compare their face with the photo on file.",
  "Accept or reject. The next pass is read automatically.",
];

export default function Scanner({ events }: { events: AttendanceEvent[] }) {
  const [eventId, setEventId] = useState(events[0].event_id);
  const [cameraOn, setCameraOn] = useState(false);
  const [pasted, setPasted] = useState("");
  // The token currently on screen; recordScan() needs it again.
  const [token, setToken] = useState("");
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pending, startTransition] = useTransition();
  // The camera reports the same code ~10 times a second; act on each one once,
  // and not while a lookup or decision is in flight.
  const busyRef = useRef(false);
  const handledRef = useRef("");
  const logIdRef = useRef(0);

  const event = events.find((e) => e.event_id === eventId) ?? events[0];
  const { opens, closes } = checkInWindow(event);
  const hasStudent = student !== null;
  const presentCount = log.filter((entry) => entry.status === "present").length;

  // The verification card is a modal: lock the page behind it and let Escape cancel.
  useEffect(() => {
    if (!hasStudent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasStudent]);

  useEffect(() => {
    if (!hasStudent || pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setToken("");
      setStudent(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasStudent, pending]);

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

  function changeEvent(id: number) {
    setEventId(id);
    reset();
    setNotice(null);
    handledRef.current = "";
  }

  function toggleCamera() {
    setCameraOn((on) => !on);
    setNotice(null);
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
        const name = student ? fullName(student) : "";
        setNotice({
          text:
            decision === "rejected" && result.data.status === "present"
              ? `${name} was already marked present, so the record was kept.`
              : `${name}: ${result.data.status}. Ready for the next student.`,
          isError: false,
        });
        if (student) {
          const entry: LogEntry = {
            id: ++logIdRef.current,
            firstName: student.first_name,
            lastName: student.last_name,
            studentId: student.student_id,
            eventName: event.event_name,
            status: result.data.status,
            at: new Date().toISOString(),
          };
          setLog((prev) => [entry, ...prev].slice(0, 50));
        }
        reset();
      } finally {
        busyRef.current = false;
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 max-[980px]:grid-cols-1">
        {/* ───────── Camera panel ───────── */}
        <Frame className="animate-fade-in-up p-0">
          <div className="border-b border-rule-soft px-5 py-4">
            <span className={FIELD_LABEL}>Scanning for</span>
            <Select
              aria-label="Event"
              value={String(eventId)}
              onChange={(value) => changeEvent(Number(value))}
              options={events.map((e) => ({ value: String(e.event_id), label: e.event_name }))}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <CheckInBadge state={checkInState(event)} />
              <span className="mono text-[11px] text-ink-soft">
                <LocalTime value={opens} format="short" /> &rarr; <LocalTime value={closes} format="short" />
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className={`relative overflow-hidden rounded-lg border border-navy-deep bg-navy-deep ${BLUEPRINT_GRID}`}>
              {cameraOn ? (
                <div className="relative min-h-[280px]">
                  <p className="mono absolute inset-0 m-0 flex items-center justify-center text-[11px] tracking-[0.08em] text-navy-tint">
                    STARTING CAMERA…
                  </p>
                  <CameraReader
                    active={cameraOn}
                    onRead={onCameraRead}
                    onError={(text) => {
                      setCameraOn(false);
                      setNotice({ text, isError: true });
                    }}
                    className="relative w-full [&_video]:block [&_video]:w-full"
                  />
                </div>
              ) : (
                <div className="relative flex aspect-[4/3] max-h-[420px] w-full flex-col items-center justify-center gap-4 p-6 text-center">
                  <ViewfinderCorners />
                  <span className="flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-navy-tint">
                    <Icon name="camera" size={26} />
                  </span>
                  <div>
                    <p className="mono mb-1 text-[11px] tracking-[0.12em] text-navy-tint">CAMERA OFF</p>
                    <p className="mb-0 max-w-[280px] text-[13px] text-paper/80">
                      Start the camera, then hold a student&apos;s pass inside the frame.
                    </p>
                  </div>
                  <button type="button" className="btn primary rounded-lg px-4 py-2 text-[13.5px]" onClick={toggleCamera}>
                    <Icon name="camera" />
                    Start camera
                  </button>
                </div>
              )}

              {pending && !student && (
                <div className="animate-fade-in absolute inset-0 z-10 flex items-center justify-center bg-navy-deep/60 backdrop-blur-[2px]">
                  <span className="mono flex items-center gap-2 rounded-full bg-paper px-3.5 py-1.5 text-[11px] text-navy-deep shadow-lg">
                    <Spinner />
                    Looking up…
                  </span>
                </div>
              )}
            </div>

            {notice && !student && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-rule-soft px-5 py-3">
            {cameraOn ? (
              <span className="mono flex items-center gap-1.5 text-[11px] text-orange">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-orange" />
                </span>
                Camera live
              </span>
            ) : (
              <span className="mono text-[11px] text-ink-soft">Camera off</span>
            )}
            {cameraOn && (
              <button type="button" className="btn ghost ml-auto rounded-lg px-3 py-1.5 text-xs" onClick={toggleCamera}>
                <Icon name="cameraOff" size={13} />
                Stop camera
              </button>
            )}
          </div>

          <details className="group border-t border-rule-soft px-5 py-3">
            <summary className="mono flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-blue hover:text-navy [&::-webkit-details-marker]:hidden">
              <span className="transition-transform duration-150 group-open:rotate-90">
                <Icon name="chevronRight" size={12} />
              </span>
              No camera? Paste a code instead
            </summary>
            <form onSubmit={onPastedSubmit} className="animate-fade-in mt-3 flex flex-wrap items-end gap-2">
              <label className="m-0 min-w-[200px] flex-1">
                <span className={FIELD_LABEL}>Student code</span>
                <input
                  type="text"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  required
                  autoComplete="off"
                  className={`${FIELD} font-mono text-[12px]`}
                />
              </label>
              <button type="submit" disabled={pending} className="btn rounded-lg px-4 py-2 text-[13px]">
                <Icon name="clipboard" size={13} />
                Look up
              </button>
            </form>
          </details>
        </Frame>

        {/* ───────── Session log + how-to ───────── */}
        <div className="flex flex-col gap-6">
          <Frame className="animate-fade-in-up p-0 [animation-delay:0.08s]">
            <PanelHeader icon="history" title="This session">
              <span className="mono text-[11px] text-ink-soft">{log.length} decided</span>
            </PanelHeader>
            <StatStrip
              columns="grid-cols-2"
              stats={[
                { label: "Present", value: presentCount, dot: "bg-blue" },
                { label: "Rejected", value: log.length - presentCount, dot: "bg-[#b3261e]" },
              ]}
            />
            {log.length === 0 ? (
              <div className="border-t border-rule-soft">
                <EmptyState icon="scan" title="NO SCANS YET">
                  Students you accept or reject on this device will be listed here.
                </EmptyState>
              </div>
            ) : (
              <ul className="m-0 max-h-[400px] list-none divide-y divide-rule-soft overflow-y-auto border-t border-rule-soft">
                {log.map((entry) => (
                  <li key={entry.id} className="animate-fade-in flex items-center gap-3 px-5 py-3">
                    <span className="mono flex size-8 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[11px] font-semibold text-navy-deep">
                      <Initials first={entry.firstName} last={entry.lastName} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-navy-deep">
                        {fullName({ first_name: entry.firstName, last_name: entry.lastName })}
                      </span>
                      <span className="mono block truncate text-[10.5px] text-ink-soft">
                        {entry.studentId} &middot; <LocalTime value={entry.at} format="time" />
                        {events.length > 1 && <> &middot; {entry.eventName}</>}
                      </span>
                    </span>
                    <AttendanceBadge status={entry.status} />
                  </li>
                ))}
              </ul>
            )}
          </Frame>

          <Frame className="animate-fade-in-up [animation-delay:0.14s]">
            <span className="eyebrow">HOW IT WORKS</span>
            <ol className="m-0 flex list-none flex-col gap-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-[13px] text-ink">
                  <span className="mono flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] text-paper">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Frame>
        </div>
      </div>

      {/* ───────── Verification modal ───────── */}
      {student && (
        <div className="animate-fade-in fixed inset-0 z-[110] flex items-end justify-center bg-navy-deep/55 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-heading"
            className="animate-pop-in max-h-full w-full max-w-[480px] overflow-y-auto rounded-t-xl border border-rule bg-paper shadow-[0_24px_60px_rgba(13,30,56,0.35)] sm:rounded-xl"
          >
            <div className={`border-b-[3px] border-orange bg-navy px-5 py-4 ${BLUEPRINT_GRID}`}>
              <span className="mono text-[10px] tracking-[0.12em] text-navy-tint uppercase">
                Verify identity &middot; {event.event_name}
              </span>
              <h2 id="verify-heading" className="mt-1 mb-0 text-[19px] text-paper">
                Is this the person in front of you?
              </h2>
            </div>

            <div className="flex gap-4 p-5 max-[440px]:flex-col max-[440px]:items-center">
              {student.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.avatarUrl}
                  alt=""
                  width={136}
                  height={136}
                  className="size-[136px] shrink-0 rounded-lg border border-rule object-cover shadow-[3px_3px_0_var(--orange)]"
                />
              ) : (
                <div className="flex size-[136px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-vellum p-3 text-center text-ink-soft">
                  <Icon name="user" size={28} />
                  <span className="mono text-[10px] leading-snug">No photo on file. Check their school ID.</span>
                </div>
              )}

              <div className="w-full min-w-0 flex-1">
                <h3 className="mb-2 text-[20px] leading-tight [overflow-wrap:anywhere] max-[440px]:text-center">
                  {fullName(student) || "Unnamed student"}
                </h3>
                <ul className="m-0 list-none divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-paper">
                  <DetailRow icon="id" label="Student ID">
                    <span className="font-mono">{student.student_id}</span>
                  </DetailRow>
                  <DetailRow icon="cap" label="Course / year">
                    {student.course ?? "—"} / {student.year_level ?? "—"}
                  </DetailRow>
                  <DetailRow icon="clock" label="Status">
                    {student.status ? (
                      <AttendanceBadge status={student.status} />
                    ) : (
                      <span className="font-normal text-ink-soft">Not recorded</span>
                    )}
                  </DetailRow>
                </ul>
              </div>
            </div>

            {student.status && student.recorded_at && (
              <p className="mono mx-5 mb-4 flex items-center gap-2 rounded-md bg-vellum px-3 py-2 text-[11px] text-ink-soft">
                <Icon name="history" size={12} />
                Already recorded {student.status} at <LocalTime value={student.recorded_at} format="time" />.
              </p>
            )}

            {notice && (
              <div className="px-5">
                <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule-soft bg-vellum/40 px-5 py-3.5">
              <button type="button" className="btn ghost rounded-lg px-3 py-2 text-[13px]" disabled={pending} onClick={reset}>
                Cancel
              </button>
              <button
                type="button"
                className={`${DANGER_BTN} ml-auto px-3 py-2 text-[13px]`}
                disabled={pending}
                onClick={() => decide("rejected")}
              >
                <Icon name="x" size={13} />
                Reject
              </button>
              <button
                type="button"
                className="btn primary rounded-lg px-4 py-2 text-[13px]"
                disabled={pending}
                onClick={() => decide("present")}
              >
                {pending ? <Spinner light /> : <Icon name="check" size={13} />}
                {pending ? "Saving…" : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
      <span className="flex shrink-0 items-center gap-2 text-ink-soft">
        <span className="flex size-5 items-center justify-center rounded bg-vellum text-navy">
          <Icon name={icon} size={11} />
        </span>
        {label}
      </span>
      <strong className="text-right font-semibold [overflow-wrap:anywhere]">{children}</strong>
    </li>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div
      role={notice.isError ? "alert" : "status"}
      className={`animate-fade-in mt-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px] ${
        notice.isError
          ? "border-[#b3261e]/30 bg-[#fbe9e7] text-[#8f1e18]"
          : "border-blue/30 bg-[#e6f3ff] text-navy-deep"
      }`}
    >
      <span
        className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-paper ${
          notice.isError ? "bg-[#b3261e]" : "bg-blue"
        }`}
      >
        <Icon name={notice.isError ? "alert" : "check"} size={12} />
      </span>
      <p className="mb-0 flex-1 font-medium">{notice.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent opacity-60 transition-opacity hover:opacity-100"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

function ViewfinderCorners() {
  const corner = "pointer-events-none absolute size-7 border-grid/60";
  return (
    <>
      <span className={`${corner} top-4 left-4 rounded-tl-md border-t-2 border-l-2`} />
      <span className={`${corner} top-4 right-4 rounded-tr-md border-t-2 border-r-2`} />
      <span className={`${corner} bottom-4 left-4 rounded-bl-md border-b-2 border-l-2`} />
      <span className={`${corner} right-4 bottom-4 rounded-br-md border-r-2 border-b-2`} />
    </>
  );
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 animate-spin rounded-full border-2 ${
        light ? "border-white/30 border-t-white" : "border-navy/20 border-t-navy"
      }`}
    />
  );
}
