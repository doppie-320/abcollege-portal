"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Tone = "danger" | "warning";

const TONES: Record<Tone, { accent: string; accentHover: string; tint: string; icon: string }> = {
  danger: {
    accent: "#b3261e",
    accentHover: "#8f1e18",
    tint: "#fbe9e7",
    icon: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5",
  },
  warning: {
    accent: "#d9531e",
    accentHover: "#b84418",
    tint: "#fcebdf",
    icon: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  },
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  errorMessage = "Something went wrong. Please try again.",
  tone = "danger",
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
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const colors = TONES[tone];

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
      setError(errorMessage);
      setBusy(false);
    }
  }

  return (
    <div
      className="backdrop"
      onClick={(e) => {
        // Don't let the click reach a parent modal's backdrop.
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmDialogHeading"
        aria-describedby="confirmDialogBody"
      >
        <div className="icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={colors.icon} />
          </svg>
        </div>
        <h2 id="confirmDialogHeading">{title}</h2>
        <p id="confirmDialogBody">{message}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="btn confirmBtn" onClick={confirm} disabled={busy}>
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 30, 56, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 110;
          animation: fadeIn 0.15s ease backwards;
        }

        .dialog {
          width: 100%;
          max-width: 400px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-top: 4px solid ${colors.accent};
          border-radius: 8px;
          padding: 22px 22px 18px;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          animation: popIn 0.18s ease backwards;
        }

        .icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${colors.tint};
          color: ${colors.accent};
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        h2 {
          font-size: 19px;
          margin-bottom: 6px;
        }

        p {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
          margin: 0;
          overflow-wrap: anywhere;
        }

        p :global(strong) {
          color: var(--ink);
        }

        .error {
          margin-top: 10px;
          color: #b3261e;
          font-size: 12.5px;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        .actions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        .confirmBtn {
          background: ${colors.accent};
          border-color: ${colors.accent};
        }

        .confirmBtn:hover:not(:disabled) {
          background: ${colors.accentHover};
          border-color: ${colors.accentHover};
        }
      `}</style>
    </div>
  );
}
