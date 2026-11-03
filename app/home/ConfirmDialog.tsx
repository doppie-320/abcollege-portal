"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";

type Tone = "danger" | "warning";

const TONES: Record<
  Tone,
  { text: string; bg: string; hoverBg: string; tint: string; eyebrow: string; icon: ReactNode }
> = {
  danger: {
    text: "text-[#b3261e]",
    bg: "bg-[#b3261e]",
    hoverBg: "hover:bg-[#8f1e18]",
    tint: "bg-[#fbe9e7]",
    eyebrow: "PERMANENT ACTION",
    icon: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />,
  },
  warning: {
    text: "text-orange",
    bg: "bg-orange",
    hoverBg: "hover:bg-[#b84418]",
    tint: "bg-[#fcebdf]",
    eyebrow: "PLEASE CONFIRM",
    icon: (
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    ),
  },
};

/** For prompts about someone's account rather than a risky action. */
export const USER_ICON = (
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  errorMessage = "Something went wrong. Please try again.",
  tone = "danger",
  eyebrow,
  icon,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  // Shown while an async onConfirm is running.
  busyLabel?: string;
  cancelLabel?: string;
  errorMessage?: string;
  tone?: Tone;
  /** Small mono label above the title; defaults to one per tone. */
  eyebrow?: string;
  /** SVG paths (24×24 viewBox) replacing the tone's default icon. */
  icon?: ReactNode;
  /** Extra content shown under the message, e.g. a summary of what's affected. */
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const backdrop = useBackdropDismiss(onCancel, !busy);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const colors = TONES[tone];
  const glyph = icon ?? colors.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

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
      setError(errorMessage);
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,30,56,0.55)] p-6 backdrop-blur-[2px]"
      onMouseDown={backdrop.onMouseDown}
      onMouseUp={backdrop.onMouseUp}
      onClick={(e) => {
        // Don't let the click reach a parent modal's backdrop.
        e.stopPropagation();
        backdrop.onClick();
      }}
    >
      <div
        className="animate-pop-in w-full max-w-[440px] overflow-hidden rounded-xl border border-rule bg-paper text-left shadow-[0_24px_60px_rgba(13,30,56,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmDialogHeading"
        aria-describedby="confirmDialogBody"
      >
        {/* Header */}
        <div className={`relative overflow-hidden px-6 pt-6 pb-5 ${colors.tint} ${colors.text}`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:20px_20px]"
          />
          <div aria-hidden="true" className="absolute -top-8 -right-8 rotate-12 opacity-[0.12]">
            <Glyph size={150} strokeWidth={1.25}>
              {glyph}
            </Glyph>
          </div>

          <div className="relative flex items-center gap-4">
            <span className="relative flex size-12 shrink-0">
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-25 [animation-iteration-count:2] motion-reduce:hidden ${colors.bg}`}
              />
              <span
                className={`relative flex size-12 items-center justify-center rounded-full text-paper shadow-[0_6px_16px_rgba(13,30,56,0.25)] ring-4 ring-paper/70 ${colors.bg}`}
              >
                <Glyph size={22}>{glyph}</Glyph>
              </span>
            </span>
            <div className="min-w-0">
              <p className="mono mb-1 text-[10.5px] tracking-[0.08em]">{eyebrow ?? colors.eyebrow}</p>
              <h2 id="confirmDialogHeading" className="mb-0 text-[20px] leading-tight text-navy-deep">
                {title}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5">
          <p
            id="confirmDialogBody"
            className="mb-0 text-[13.5px] leading-relaxed [overflow-wrap:anywhere] text-ink-soft [&_strong]:text-ink"
          >
            {message}
          </p>

          {children}

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
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn rounded-lg border-transparent px-4 py-2 text-[13.5px] shadow-[0_4px_12px_rgba(13,30,56,0.18)] ${colors.bg} ${colors.hoverBg}`}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
            ) : (
              <Glyph size={14}>{glyph}</Glyph>
            )}
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Glyph({
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
