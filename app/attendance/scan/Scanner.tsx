"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Select from "@/components/Select";
import {
  checkInState,
  checkInWindow,
  type AttendanceEvent,
  type AttendanceMethod,
  type AttendanceStatus,
  type ScannedStudent,
} from "@/lib/attendance";
import { lookupScan, lookupStudentId, recordScan, recordStudentId } from "../actions";
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
  MethodTag,
  PanelHeader,
  StatStrip,
  type IconName,
} from "../ui";
import CameraReader from "./CameraReader";

type Notice = { text: string; isError: boolean };

/** How the student on screen was found; recording needs the same thing again. */
type Source = { kind: "qr"; token: string } | { kind: "id"; studentId: string };

/** A decision made on this device, for the session log. Not persisted. */
type LogEntry = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  studentId: string;
  eventName: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  at: string;
};

function fullName(student: Pick<ScannedStudent, "first_name" | "last_name">): string {
  return `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
}

const STEPS = [
  "Pick the event you're checking students into.",
  "Frame the student's pass, or type their student number if they can't show it.",
  "Compare their face with the photo on file.",
  "Accept or reject. The next pass is read automatically.",
];

export default function Scanner({ events }: { events: AttendanceEvent[] }) {
  const [eventId, setEventId] = useState(events[0].event_id);
  const [cameraOn, setCameraOn] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [manualId, setManualId] = useState("");
  // Optional reason saved with a manual check-in.
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  // Big check/cross over the camera right after a decision.
  const [flash, setFlash] = useState<{ id: number; status: AttendanceStatus; name: string } | null>(null);
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

  // Keyboard shortcuts while verifying: A accept, R reject, Escape cancel.
  // decide() changes every render, so the listener reads it through a ref.
  const decideRef = useRef<(decision: AttendanceStatus) => void>(() => {});
  useEffect(() => {
    decideRef.current = decide;
  });

  useEffect(() => {
    if (!hasStudent || pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();
      // Letters typed into the reason field aren't shortcuts.
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (typing && key !== "escape") return;
      if (key === "escape") {
        setSource(null);
        setStudent(null);
      } else if (key === "a") {
        decideRef.current("present");
      } else if (key === "r") {
        decideRef.current("rejected");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasStudent, pending]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [flash]);

  function reset() {
    setSource(null);
    setStudent(null);
  }

  function lookup(next: Source) {
    if (busyRef.current) return;
    busyRef.current = true;
    if (next.kind === "qr") handledRef.current = next.token;

    startTransition(async () => {
      try {
        const result =
          next.kind === "qr" ? await lookupScan(eventId, next.token) : await lookupStudentId(eventId, next.studentId);
        if (result.error !== undefined) {
          reset();
          setNotice({ text: result.error, isError: true });
          return;
        }
        // A short buzz tells the scanner a student was found without looking.
        navigator.vibrate?.(40);
        setSource(next);
        setStudent(result.data);
        setNote("");
        setNotice(null);
        // Kept on failure so a typo can be fixed.
        if (next.kind === "id") setManualId("");
      } finally {
        busyRef.current = false;
      }
    });
  }

  function onCameraRead(text: string) {
    const scanned = text.trim();
    if (!scanned || student || scanned === handledRef.current) return;
    lookup({ kind: "qr", token: scanned });
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    const studentId = manualId.trim();
    if (studentId) lookup({ kind: "id", studentId });
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
    if (!source) return;
    busyRef.current = true;
    startTransition(async () => {
      try {
        const result =
          source.kind === "qr"
            ? await recordScan(eventId, source.token, decision)
            : await recordStudentId(eventId, source.studentId, decision, note);
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
            method: source.kind === "qr" ? "scan" : "manual",
            at: new Date().toISOString(),
          };
          setLog((prev) => [entry, ...prev].slice(0, 50));
          setFlash({ id: entry.id, status: entry.status, name });
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
                  <span className="relative flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-navy-tint">
                    <span className="absolute inset-0 animate-[ping_2.6s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full border border-grid/40 motion-reduce:hidden" />
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

              {cameraOn && !pending && !student && !flash && (
                <span className="animate-scan-sweep pointer-events-none absolute inset-x-8 z-10 h-0.5 rounded-full bg-orange shadow-[0_0_14px_3px_rgba(217,83,30,0.55)] motion-reduce:hidden" />
              )}

              {flash && (
                <div
                  key={flash.id}
                  className={`animate-fade-in pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 ${
                    flash.status === "present" ? "bg-blue/45" : "bg-[#b3261e]/45"
                  }`}
                >
                  <span
                    className={`animate-pop-in flex size-20 items-center justify-center rounded-full border-4 border-paper text-paper shadow-[0_12px_32px_rgba(0,0,0,0.3)] ${
                      flash.status === "present" ? "bg-blue" : "bg-[#b3261e]"
                    }`}
                  >
                    <Icon name={flash.status === "present" ? "check" : "x"} size={38} />
                  </span>
                  <span className="animate-fade-in-up mono rounded-full bg-paper px-3 py-1 text-[11px] text-navy-deep shadow-lg [animation-delay:0.08s]">
                    {flash.name || "Student"} &middot; {flash.status}
                  </span>
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

          <form onSubmit={onManualSubmit} className="border-t border-rule-soft bg-vellum/30 px-5 py-4">
            <label htmlFor="manual-student-id" className={FIELD_LABEL}>
              No pass? Enter their student number
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">
                  <Icon name="id" size={14} />
                </span>
                <input
                  id="manual-student-id"
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Student number"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD} pl-9 font-mono tracking-wide`}
                />
              </div>
              <button type="submit" disabled={pending || !manualId.trim()} className="btn rounded-lg px-4 py-2 text-[13px]">
                <Icon name="search" size={13} />
                Find
              </button>
            </div>
            <p className="mt-1.5 mb-0 text-[11.5px] text-ink-soft">
              Check it against their school ID. It&apos;s saved as a manual check-in under your name.
            </p>
          </form>
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
                { label: "Present", value: <Bump value={presentCount} />, dot: "bg-blue" },
                { label: "Rejected", value: <Bump value={log.length - presentCount} />, dot: "bg-[#b3261e]" },
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
                  <li key={entry.id} className="animate-fade-in-up flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-vellum/40">
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
                    {entry.method === "manual" && <MethodTag method="manual" />}
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
              <div className="flex items-center justify-between gap-3">
                <span className="mono text-[10px] tracking-[0.12em] text-navy-tint uppercase">
                  Verify identity &middot; {event.event_name}
                </span>
                {source?.kind === "id" && (
                  <span className="mono shrink-0 rounded border border-orange/60 bg-orange/20 px-1.5 py-px text-[9.5px] tracking-[0.08em] text-paper">
                    MANUAL
                  </span>
                )}
              </div>
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
                  className="animate-pop-in size-[136px] shrink-0 rounded-lg border border-rule object-cover shadow-[3px_3px_0_var(--orange)] [animation-delay:0.08s]"
                />
              ) : (
                <div className="animate-pop-in flex size-[136px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-vellum p-3 text-center text-ink-soft">
                  <Icon name="user" size={28} />
                  <span className="mono text-[10px] leading-snug">No photo on file. Check their school ID.</span>
                </div>
              )}

              <div className="animate-fade-in-up w-full min-w-0 flex-1 [animation-delay:0.12s]">
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

            {source?.kind === "id" && (
              <div className="animate-fade-in-up mx-5 mb-4 [animation-delay:0.16s]">
                <p className="mb-3 flex items-start gap-2 rounded-md border border-orange/30 bg-orange/10 px-3 py-2 text-[12px] text-navy-deep">
                  <span className="mt-px text-orange">
                    <Icon name="alert" size={13} />
                  </span>
                  No QR was shown, so check their face and school ID carefully.
                </p>
                <label htmlFor="manual-note" className={FIELD_LABEL}>
                  Reason (optional)
                </label>
                <input
                  id="manual-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Phone died"
                  autoComplete="off"
                  className={FIELD}
                />
              </div>
            )}

            {notice && (
              <div className="px-5">
                <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule-soft bg-vellum/40 px-5 py-3.5">
              <button type="button" className="btn ghost rounded-lg px-3 py-2 text-[13px]" disabled={pending} onClick={reset}>
                Cancel
                <Kbd>Esc</Kbd>
              </button>
              <button
                type="button"
                className={`${DANGER_BTN} ml-auto px-3 py-2 text-[13px]`}
                disabled={pending}
                onClick={() => decide("rejected")}
              >
                <Icon name="x" size={13} />
                Reject
                <Kbd>R</Kbd>
              </button>
              <button
                type="button"
                className="btn primary rounded-lg px-4 py-2 text-[13px]"
                disabled={pending}
                onClick={() => decide("present")}
              >
                {pending ? <Spinner light /> : <Icon name="check" size={13} />}
                {pending ? "Saving…" : "Accept"}
                {!pending && <Kbd light>A</Kbd>}
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

/** A number that pops each time it changes. */
function Bump({ value }: { value: number }) {
  return (
    <span key={value} className="inline-block animate-pop-in tabular-nums">
      {value}
    </span>
  );
}

/** Shortcut hint, shown only on devices with a mouse (and so, usually, a keyboard). */
function Kbd({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <kbd
      className={`mono hidden rounded border px-1 py-px text-[9.5px] leading-none font-normal pointer-fine:inline ${
        light ? "border-white/40 text-white/80" : "border-current/30 opacity-70"
      }`}
    >
      {children}
    </kbd>
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
