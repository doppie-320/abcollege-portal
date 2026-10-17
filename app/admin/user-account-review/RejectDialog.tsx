"use client";

import { useState } from "react";
import ConfirmDialog, { Glyph } from "@/app/home/ConfirmDialog";
import { applicantInitials, applicantName, type Applicant } from "@/lib/applicants-db";

export type RejectMode = "delayed" | "immediate";

const GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const TRASH = <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />;

const CLOCK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);

type RejectDialogProps = {
  mode: RejectMode;
  applicant: Applicant;
  onCancel: () => void;
  // Throws on failure so the dialog stays open and shows its error.
  onConfirm: () => Promise<void>;
};

/** Delayed rejects lean orange (the account lingers for a week); immediate ones go full red. */
export default function RejectDialog({ mode, applicant, onCancel, onConfirm }: RejectDialogProps) {
  const [deletesOn] = useState(() =>
    new Date(Date.now() + GRACE_DAYS * DAY_MS).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );
  const name = applicantName(applicant);
  const delayed = mode === "delayed";

  return (
    <ConfirmDialog
      tone={delayed ? "warning" : "danger"}
      eyebrow={delayed ? `REJECT · ${GRACE_DAYS}-DAY GRACE PERIOD` : "REJECT · PERMANENT"}
      icon={delayed ? CLOCK : TRASH}
      title={delayed ? "Reject this application?" : "Reject immediately?"}
      message={
        delayed ? (
          <>
            <strong>{name}</strong>&rsquo;s registration will be rejected now, and their account
            will be deleted automatically after {GRACE_DAYS} days.
          </>
        ) : (
          <>
            <strong>{name}</strong>&rsquo;s registration will be rejected right away, with no{" "}
            {GRACE_DAYS}-day grace period.
          </>
        )
      }
      confirmLabel="Reject application"
      busyLabel="Rejecting…"
      errorMessage="Couldn't reject this application. Please try again."
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-rule-soft bg-vellum/40 px-3 py-2.5">
        <span className="mono relative flex size-10 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[12px] font-semibold text-navy-deep">
          {applicantInitials(applicant)}
          <span
            className={`absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full border-2 border-paper text-paper ${
              delayed ? "bg-orange" : "bg-[#b3261e]"
            }`}
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

      {delayed ? (
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
              <Glyph size={16}>{TRASH}</Glyph>
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
    </ConfirmDialog>
  );
}
