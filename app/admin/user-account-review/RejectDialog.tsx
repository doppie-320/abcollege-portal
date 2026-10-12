"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { applicantInitials, applicantName, type Applicant } from "@/lib/applicants-db";

export type RejectMode = "delayed" | "immediate";

const GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Delayed rejects lean orange (recoverable for a week); immediate ones go full red. */
const MODES: Record<
  RejectMode,
  {
    eyebrow: string;
    title: string;
    text: string;
    bg: string;
    hoverBg: string;
    tint: string;
    icon: ReactNode;
  }
> = {
  delayed: {
    eyebrow: `REJECT · ${GRACE_DAYS}-DAY GRACE PERIOD`,
    title: "Reject this application?",
    text: "text-orange",
    bg: "bg-orange",
    hoverBg: "hover:bg-[#b84418]",
    tint: "bg-[#fcebdf]",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  immediate: {
    eyebrow: "REJECT · PERMANENT",
    title: "Reject immediately?",
    text: "text-[#b3261e]",
    bg: "bg-[#b3261e]",
    hoverBg: "hover:bg-[#8f1e18]",
    tint: "bg-[#fbe9e7]",
    icon: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />,
  },
};

type RejectDialogProps = {
  mode: RejectMode;
  applicant: Applicant;
  onCancel: () => void;
  // Throws on failure so the dialog stays open and shows its error.
  onConfirm: () => Promise<void>;
};

export default function RejectDialog({ mode, applicant, onCancel, onConfirm }: RejectDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletesOn] = useState(() =>
    new Date(Date.now() + GRACE_DAYS * DAY_MS).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );
  const backdrop = useBackdropDismiss(onCancel, !busy);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const tone = MODES[mode];
  const name = applicantName(applicant);

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

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch {
      setError("Couldn't reject this application. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,30,56,0.55)] p-6 backdrop-blur-[2px]"
      onMouseDown={backdrop.onMouseDown}
      onMouseUp={backdrop.onMouseUp}
      onClick={backdrop.onClick}
    >
      <div
        className="animate-pop-in w-full max-w-[440px] overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_24px_60px_rgba(13,30,56,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rejectDialogHeading"
        aria-describedby="rejectDialogBody"
      >
        {/* Header */}
        <div className={`relative overflow-hidden px-6 pt-6 pb-5 ${tone.tint} ${tone.text}`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:20px_20px]"
          />
          <div aria-hidden="true" className="absolute -top-8 -right-8 rotate-12 opacity-[0.12]">
            <Glyph size={150} strokeWidth={1.25}>
              {tone.icon}
            </Glyph>
          </div>

          <div className="relative flex items-center gap-4">
            <span className="relative flex size-12 shrink-0">
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-25 [animation-iteration-count:2] ${tone.bg}`}
              />
              <span
                className={`relative flex size-12 items-center justify-center rounded-full text-paper shadow-[0_6px_16px_rgba(13,30,56,0.25)] ring-4 ring-paper/70 ${tone.bg}`}
              >
                <Glyph size={22}>{tone.icon}</Glyph>
              </span>
            </span>
            <div className="min-w-0">
              <p className="mono mb-1 text-[10.5px] tracking-[0.08em]">{tone.eyebrow}</p>
              <h2 id="rejectDialogHeading" className="mb-0 text-[20px] leading-tight text-navy-deep">
                {tone.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5">
          <div className="flex items-center gap-3 rounded-lg border border-rule-soft bg-vellum/40 px-3 py-2.5">
            <span className="mono relative flex size-10 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[12px] font-semibold text-navy-deep">
              {applicantInitials(applicant)}
              <span
                className={`absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full border-2 border-paper text-paper ${tone.bg}`}
              >
                <Glyph size={9} strokeWidth={3.5}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </Glyph>
              </span>
            </span>
            <div className="min-w-0">
              <p className="mb-0 truncate text-[14px] font-semibold text-navy-deep">{name}</p>
              <p className="mono mb-0 truncate text-[11px] text-ink-soft">{applicant.email}</p>
            </div>
          </div>

          <p id="rejectDialogBody" className="mt-4 mb-0 text-[13.5px] leading-relaxed text-ink-soft">
            {mode === "delayed" ? (
              <>
                <strong className="text-ink">{name}</strong>&rsquo;s registration will be rejected
                now, and their account will be deleted automatically after {GRACE_DAYS} days.
              </>
            ) : (
              <>
                <strong className="text-ink">{name}</strong>&rsquo;s registration will be rejected
                right away, with no {GRACE_DAYS}-day grace period.
              </>
            )}
          </p>

          {mode === "delayed" ? (
            <div className="mt-4" aria-hidden="true">
              <div className="mono mb-2 flex items-baseline justify-between text-[10.5px] tracking-[0.06em]">
                <span className="text-navy">TODAY</span>
                <span className="text-orange">DELETED {deletesOn.toUpperCase()}</span>
              </div>
              <ol className="m-0 flex list-none items-center gap-1 p-0">
                <li className="animate-pop-in">
                  <span className="block size-2.5 rounded-full bg-navy ring-4 ring-navy/15" />
                </li>
                {Array.from({ length: GRACE_DAYS }, (_, i) => (
                  <li
                    key={i}
                    className="animate-pop-in flex-1"
                    style={{ animationDelay: `${150 + i * 55}ms` }}
                  >
                    <span
                      className="block h-1.5 rounded-full bg-orange"
                      style={{ opacity: 0.2 + ((i + 1) / GRACE_DAYS) * 0.8 }}
                    />
                  </li>
                ))}
                <li
                  className="animate-pop-in text-orange"
                  style={{ animationDelay: `${150 + GRACE_DAYS * 55}ms` }}
                >
                  <Glyph size={16}>
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
                  </Glyph>
                </li>
              </ol>
            </div>
          ) : (
            <div className="animate-pop-in mt-4 flex items-center gap-3 rounded-lg border border-[#b3261e]/30 px-3.5 py-3 text-[#b3261e] [animation-delay:120ms] [background:repeating-linear-gradient(-45deg,#fbe9e7_0_8px,#f7ddd9_8px_16px)]">
              <Glyph size={18}>
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </Glyph>
              <div>
                <p className="mb-0 text-[13px] font-semibold">No grace period</p>
                <p className="mono mb-0 text-[10.5px] tracking-[0.06em]">THIS CAN&rsquo;T BE UNDONE</p>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 mb-0 text-[12.5px] text-[#b3261e]" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t border-rule-soft bg-vellum/30 px-6 py-3.5">
          <button
            ref={cancelRef}
            type="button"
            className="btn ghost rounded-lg px-4 py-2 text-[13.5px]"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn rounded-lg border-transparent px-4 py-2 text-[13.5px] shadow-[0_4px_12px_rgba(13,30,56,0.18)] ${tone.bg} ${tone.hoverBg}`}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
            ) : (
              <Glyph size={14}>{tone.icon}</Glyph>
            )}
            {busy ? "Rejecting…" : "Reject application"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Glyph({
  children,
  size,
  strokeWidth = 2,
}: {
  children: ReactNode;
  size: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
