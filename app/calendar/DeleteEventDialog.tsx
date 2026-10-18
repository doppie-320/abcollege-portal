"use client";

import { useEffect, useRef, useState } from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { TAG_LABELS, formatEventDates, formatEventTime, type CalendarEvent } from "@/lib/calendar";

type Props = {
  event: CalendarEvent;
  onCancel: () => void;
  /** Starts the delete. The event leaves the calendar at once; the calendar restores it if that fails. */
  onConfirm: () => void;
  /** Called once the toss animation has played. */
  onDeleted: () => void;
};

/** The ticket flies into the bin, then the dialog fades out. Keep in sync with the CSS below. */
const TOSS_MS = 450;
const FADE_MS = 220;

export default function DeleteEventDialog({ event, onCancel, onConfirm, onDeleted }: Props) {
  const [phase, setPhase] = useState<"idle" | "tossing" | "closing">("idle");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const tossed = phase !== "idle";
  const backdrop = useBackdropDismiss(onCancel, !tossed);

  useEffect(() => {
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !tossed) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tossed, onCancel]);

  function confirm() {
    onConfirm();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDeleted();
      return;
    }
    setPhase("tossing");
    setTimeout(() => setPhase("closing"), TOSS_MS);
    setTimeout(onDeleted, TOSS_MS + FADE_MS);
  }

  return (
    <div className={`delBackdrop${phase === "closing" ? " isClosing" : ""}`} {...backdrop}>
      <div
        className={`delDialog${tossed ? " isTossed" : ""}${phase === "closing" ? " isClosing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deleteEventHeading"
        aria-describedby="deleteEventBody"
      >
        <div className="delAccent" aria-hidden="true" />

        <div className="delBody">
          <div className="delIcon" aria-hidden="true">
            <TrashIcon size={22} />
          </div>

          <h2 id="deleteEventHeading">Delete this event?</h2>
          <p id="deleteEventBody">
            It&apos;ll be removed from everyone&apos;s calendar. This can&apos;t be undone.
          </p>

          <div className={`delTicket tone-${event.tag.toLowerCase()}`}>
            <span className="delTicketStub mono">{formatEventDates(event).toUpperCase()}</span>
            <span className="delTicketMain">
              <strong>{event.name}</strong>
              <span className="delTicketMeta">
                {TAG_LABELS[event.tag]} · {formatEventTime(event)}
              </span>
            </span>
          </div>

        </div>

        <div className="delActions">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={onCancel} disabled={tossed}>
            Keep it
          </button>
          <button type="button" className="btn delConfirm" onClick={confirm} disabled={tossed}>
            <TrashIcon size={15} />
            {tossed ? "Deleted" : "Delete event"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .delBackdrop {
          position: fixed;
          inset: 0;
          z-index: 110;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(13, 30, 56, 0.55);
          backdrop-filter: blur(2px);
          animation: fadeIn 0.15s ease backwards;
        }

        .delBackdrop.isClosing {
          animation: delFadeOut 0.22s ease forwards;
        }

        @keyframes delFadeOut {
          to {
            opacity: 0;
          }
        }

        .delDialog {
          width: 100%;
          max-width: 420px;
          overflow: hidden;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 10px;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          animation: delDrop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        @keyframes delDrop {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(0.96);
          }
        }

        .delDialog.isClosing {
          animation: delShrink 0.22s ease forwards;
        }

        @keyframes delShrink {
          to {
            transform: scale(0.94);
          }
        }

        /* A thin red rule that draws itself across the top once, as the dialog opens. */
        .delAccent {
          height: 4px;
          background: #b3261e;
          transform-origin: left;
          animation: delSweep 0.5s 0.12s cubic-bezier(0.65, 0, 0.35, 1) backwards;
        }

        @keyframes delSweep {
          from {
            transform: scaleX(0);
          }
        }

        .delBody {
          padding: 22px 22px 6px;
          text-align: center;
        }

        .delIcon {
          width: 52px;
          height: 52px;
          margin: 0 auto 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fbe9e7;
          color: #b3261e;
          box-shadow: 0 0 0 6px rgba(179, 38, 30, 0.08);
          animation: delHalo 1.6s ease-out 0.2s 2;
        }

        /* A soft ring that breathes out from the icon twice, then settles. */
        @keyframes delHalo {
          0% {
            box-shadow: 0 0 0 0 rgba(179, 38, 30, 0.22);
          }
          100% {
            box-shadow: 0 0 0 14px rgba(179, 38, 30, 0);
          }
        }

        /* The lid gives a nervous rattle when the dialog opens... */
        .delIcon :global(.lid) {
          transform-box: fill-box;
          transform-origin: left bottom;
          animation: delRattle 0.6s ease 0.3s 1;
        }

        @keyframes delRattle {
          0%,
          100% {
            transform: none;
          }
          30% {
            transform: rotate(-16deg) translateY(-1px);
          }
          60% {
            transform: rotate(-6deg);
          }
        }

        /* ...and swings open to catch the ticket. */
        .delDialog.isTossed .delIcon :global(.lid) {
          animation: delLidOpen 0.6s ease forwards;
        }

        @keyframes delLidOpen {
          0% {
            transform: none;
          }
          25%,
          70% {
            transform: rotate(-38deg) translateY(-2px);
          }
          100% {
            transform: none;
          }
        }

        h2 {
          margin: 0 0 6px;
          font-size: 20px;
        }

        .delBody > p {
          margin: 0 auto;
          max-width: 320px;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
        }

        /* The event, drawn as a ticket stub. */
        .delTicket {
          position: relative;
          display: flex;
          align-items: stretch;
          margin: 16px 0 4px;
          text-align: left;
          border: 1px solid var(--rule-soft);
          border-left: 4px solid var(--tone);
          border-radius: 6px;
          background: var(--white);
          box-shadow: 0 6px 14px -8px rgba(13, 30, 56, 0.35);
        }

        .delTicketStub {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 92px;
          padding: 10px 8px;
          border-right: 2px dashed var(--rule-soft);
          background: var(--tone-tint);
          color: var(--tone);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-align: center;
        }

        .delTicketMain {
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 10px 12px;
        }

        .delTicketMain strong {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--navy-deep);
          overflow-wrap: anywhere;
        }

        .delTicketMeta {
          font-size: 12px;
          color: var(--ink-soft);
        }

        /* Tossed up into the bin. */
        .delDialog.isTossed .delTicket {
          animation: delToss 0.45s cubic-bezier(0.55, 0, 0.75, 0.4) forwards;
        }

        @keyframes delToss {
          30% {
            transform: translateY(8px) rotate(4deg) scale(0.96);
          }
          100% {
            transform: translateY(-150px) rotate(-24deg) scale(0.1);
            opacity: 0;
          }
        }

        .delActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 22px;
          border-top: 1px solid #c9bfa0;
          background: var(--vellum);
        }

        .delActions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        .delConfirm {
          gap: 7px;
          background: #b3261e;
          border-color: #b3261e;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .delConfirm:hover:not(:disabled) {
          background: #8f1e18;
          border-color: #8f1e18;
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--navy-deep), 6px 6px 0 var(--yellow);
        }

        .delConfirm:active:not(:disabled) {
          transform: none;
          box-shadow: none;
        }

        .delConfirm:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        /* The button's own lid pops up on hover. */
        .delConfirm :global(.lid) {
          transform-box: fill-box;
          transform-origin: left bottom;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .delConfirm:hover:not(:disabled) :global(.lid) {
          transform: rotate(-14deg) translateY(-1px);
        }

        @media (prefers-reduced-motion: reduce) {
          .delDialog,
          .delAccent,
          .delIcon,
          .delIcon :global(.lid),
          .delBackdrop {
            animation: none;
          }

          .delConfirm,
          .delConfirm :global(.lid) {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

function TrashIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
    >
      <g className="lid">
        <path d="M3 6h18" />
        <path d="M9 6V4h6v2" />
      </g>
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}
