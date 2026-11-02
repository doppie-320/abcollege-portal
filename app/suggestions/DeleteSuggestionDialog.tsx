"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { CATEGORY_LABELS, type Suggestion } from "@/lib/suggestions";
import { CategoryIcon, toneClass } from "./ui";

type Props = {
  suggestion: Suggestion;
  /** "own": the author deletes it. "moderate": an admin takes someone else's down. */
  mode: "own" | "moderate";
  onCancel: () => void;
  /** Starts the delete. The card leaves the board at once; the page restores it if that fails. */
  onConfirm: () => void;
  /** Called once the closing animation has played. */
  onDone: () => void;
};

/** Keep in sync with the CSS below. */
const STAMP_MS = 380;
const TOSS_MS = 450;
const FADE_MS = 220;

export default function DeleteSuggestionDialog({ suggestion, mode, onCancel, onConfirm, onDone }: Props) {
  const [phase, setPhase] = useState<"idle" | "stamping" | "tossing" | "closing">("idle");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busy = phase !== "idle";
  const backdrop = useBackdropDismiss(onCancel, !busy);
  const moderating = mode === "moderate";

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
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  function confirm() {
    onConfirm();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    // Moderation slams a REMOVED stamp on the note before it goes in the bin.
    const stamp = moderating ? STAMP_MS : 0;
    if (moderating) setPhase("stamping");
    setTimeout(() => setPhase("tossing"), stamp);
    setTimeout(() => setPhase("closing"), stamp + TOSS_MS);
    setTimeout(onDone, stamp + TOSS_MS + FADE_MS);
  }

  const author = suggestion.anonymous || !suggestion.author ? "Anonymous student" : suggestion.author.name;

  return (
    <div className={`sgdBackdrop${phase === "closing" ? " isClosing" : ""}`} {...backdrop}>
      <div
        className={`sgdDialog phase-${phase}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deleteSuggestionHeading"
        aria-describedby="deleteSuggestionBody"
      >
        <div className="sgdAccent" aria-hidden="true" />

        <div className="sgdBody">
          <div className="sgdIcon" aria-hidden="true">
            {moderating ? <Flag size={22} strokeWidth={2} /> : <TrashIcon size={22} />}
          </div>

          <h2 id="deleteSuggestionHeading">{moderating ? "Remove as inappropriate?" : "Delete your suggestion?"}</h2>
          <p id="deleteSuggestionBody">
            {moderating
              ? "It'll be taken down for everyone, including the student who posted it. This can't be undone."
              : "It'll be taken out of the box for good. This can't be undone."}
          </p>

          <div className={`sgdNote ${toneClass(suggestion.category)}`}>
            <span className="sgdNoteStub">
              <CategoryIcon category={suggestion.category} size={15} />
              <span className="mono">{CATEGORY_LABELS[suggestion.category].toUpperCase()}</span>
            </span>
            <span className="sgdNoteMain">
              <strong>{suggestion.title}</strong>
              {moderating && <span className="sgdNoteMeta">by {author}</span>}
            </span>
            {moderating && (
              <span className="sgdStamp mono" aria-hidden="true">
                REMOVED
              </span>
            )}
          </div>
        </div>

        <div className="sgdActions">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Keep it
          </button>
          <button type="button" className="btn sgdConfirm" onClick={confirm} disabled={busy}>
            {moderating ? <Flag size={15} strokeWidth={2} aria-hidden="true" /> : <TrashIcon size={15} />}
            {busy ? (moderating ? "Removed" : "Deleted") : moderating ? "Remove suggestion" : "Delete"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .sgdBackdrop {
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

        .sgdBackdrop.isClosing {
          animation: fadeOut 0.22s ease forwards;
        }

        .sgdDialog {
          width: 100%;
          max-width: 420px;
          overflow: hidden;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 10px;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          animation: sgdDrop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        @keyframes sgdDrop {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(0.96);
          }
        }

        .sgdDialog.phase-closing {
          animation: sgdShrink 0.22s ease forwards;
        }

        @keyframes sgdShrink {
          to {
            transform: scale(0.94);
          }
        }

        .sgdAccent {
          height: 4px;
          background: #b3261e;
          transform-origin: left;
          animation: sgdSweep 0.5s 0.12s cubic-bezier(0.65, 0, 0.35, 1) backwards;
        }

        @keyframes sgdSweep {
          from {
            transform: scaleX(0);
          }
        }

        .sgdBody {
          padding: 22px 22px 6px;
          text-align: center;
        }

        .sgdIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          margin: 0 auto 12px;
          border-radius: 50%;
          background: #fbe9e7;
          color: #b3261e;
          box-shadow: 0 0 0 6px rgba(179, 38, 30, 0.08);
          animation: sgdHalo 1.6s ease-out 0.2s 2;
        }

        @keyframes sgdHalo {
          0% {
            box-shadow: 0 0 0 0 rgba(179, 38, 30, 0.22);
          }
          100% {
            box-shadow: 0 0 0 14px rgba(179, 38, 30, 0);
          }
        }

        .sgdIcon :global(.lid) {
          transform-box: fill-box;
          transform-origin: left bottom;
          animation: sgdRattle 0.6s ease 0.3s 1;
        }

        @keyframes sgdRattle {
          30% {
            transform: rotate(-16deg) translateY(-1px);
          }
          60% {
            transform: rotate(-6deg);
          }
        }

        .phase-tossing .sgdIcon :global(.lid) {
          animation: sgdLidOpen 0.6s ease forwards;
        }

        @keyframes sgdLidOpen {
          25%,
          70% {
            transform: rotate(-38deg) translateY(-2px);
          }
        }

        h2 {
          margin: 0 0 6px;
          font-size: 20px;
        }

        .sgdBody > p {
          max-width: 320px;
          margin: 0 auto;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
        }

        /* The suggestion, drawn as a small index card. */
        .sgdNote {
          position: relative;
          display: flex;
          align-items: stretch;
          margin: 16px 0 4px;
          text-align: left;
          border: 1px solid var(--rule-soft);
          border-left: 4px solid var(--sg-tone);
          border-radius: 6px;
          background: var(--white);
          box-shadow: 0 6px 14px -8px rgba(13, 30, 56, 0.35);
        }

        .sgdNoteStub {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex-shrink: 0;
          width: 92px;
          padding: 10px 6px;
          border-right: 2px dashed var(--rule-soft);
          background: var(--sg-tint);
          color: var(--sg-tone);
          font-size: 10px;
          letter-spacing: 0.04em;
        }

        .sgdNoteMain {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          padding: 10px 12px;
        }

        .sgdNoteMain strong {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--navy-deep);
          overflow-wrap: anywhere;
        }

        .sgdNoteMeta {
          font-size: 12px;
          color: var(--ink-soft);
        }

        /* Rubber stamp: hidden until the admin confirms, then slams down at an angle. */
        .sgdStamp {
          position: absolute;
          top: 50%;
          left: 58%;
          padding: 3px 10px;
          border: 3px double #b3261e;
          border-radius: 4px;
          color: #b3261e;
          background: rgba(251, 233, 231, 0.85);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.18em;
          opacity: 0;
          transform: translate(-50%, -50%) rotate(-12deg) scale(2.4);
          pointer-events: none;
        }

        .phase-stamping .sgdStamp,
        .phase-tossing .sgdStamp,
        .phase-closing .sgdStamp {
          animation: sgdStamp 0.32s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }

        @keyframes sgdStamp {
          70% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(-12deg) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(-12deg) scale(1);
          }
        }

        /* The thud of the stamp shakes the card a little. */
        .phase-stamping .sgdNote {
          animation: sgdThud 0.3s ease 0.22s;
        }

        @keyframes sgdThud {
          30% {
            transform: translateY(2px) scale(0.99);
          }
          60% {
            transform: translateY(-1px);
          }
        }

        .phase-tossing .sgdNote,
        .phase-closing .sgdNote {
          animation: sgdToss 0.45s cubic-bezier(0.55, 0, 0.75, 0.4) forwards;
        }

        @keyframes sgdToss {
          30% {
            transform: translateY(8px) rotate(4deg) scale(0.96);
          }
          100% {
            transform: translateY(-150px) rotate(-24deg) scale(0.1);
            opacity: 0;
          }
        }

        .sgdActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 22px;
          border-top: 1px solid #c9bfa0;
          background: var(--vellum);
        }

        .sgdActions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        .sgdConfirm {
          gap: 7px;
          background: #b3261e;
          border-color: #b3261e;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgdConfirm:hover:not(:disabled) {
          background: #8f1e18;
          border-color: #8f1e18;
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--navy-deep), 6px 6px 0 var(--yellow);
        }

        .sgdConfirm:active:not(:disabled) {
          transform: none;
          box-shadow: none;
        }

        .sgdConfirm:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .sgdConfirm :global(.lid) {
          transform-box: fill-box;
          transform-origin: left bottom;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .sgdConfirm:hover:not(:disabled) :global(.lid) {
          transform: rotate(-14deg) translateY(-1px);
        }

        @media (max-width: 520px) {
          .sgdBackdrop {
            padding: 16px;
          }

          .sgdBody {
            padding: 20px 16px 4px;
          }

          .sgdActions {
            padding: 12px 16px;
          }

          .sgdActions .btn {
            flex: 1;
            padding: 10px 12px;
          }

          .sgdNoteStub {
            width: 76px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sgdBackdrop,
          .sgdDialog,
          .sgdAccent,
          .sgdIcon,
          .sgdIcon :global(.lid) {
            animation: none;
          }

          .sgdConfirm,
          .sgdConfirm :global(.lid) {
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
      aria-hidden="true"
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
