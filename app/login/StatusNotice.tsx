"use client";

import type { Notice, NoticeKind } from "./messages";

const KINDS: Record<
  NoticeKind,
  { eyebrow: string; title: string; accent: string; tint: string; role: "status" | "alert" }
> = {
  pending: {
    eyebrow: "ACCOUNT STATUS · PENDING",
    title: "Still under review",
    accent: "#d9531e",
    tint: "rgba(217, 83, 30, 0.09)",
    role: "status",
  },
  rejected: {
    eyebrow: "ACCOUNT STATUS · NOT APPROVED",
    title: "Request not approved",
    accent: "#b3261e",
    tint: "rgba(179, 38, 30, 0.08)",
    role: "alert",
  },
  error: {
    eyebrow: "SIGN-IN ERROR",
    title: "Couldn't log you in",
    accent: "#b3261e",
    tint: "rgba(179, 38, 30, 0.08)",
    role: "alert",
  },
};

export default function StatusNotice({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: () => void;
}) {
  const kind = KINDS[notice.kind];

  return (
    // key on the message so a new notice replays the entrance animation
    <div key={notice.message} className={`notice ${notice.kind}`} role={kind.role}>
      <div className="badge" aria-hidden="true">
        <NoticeIcon kind={notice.kind} />
      </div>

      <div className="body">
        <span className="eyebrowLine">{kind.eyebrow}</span>
        <p className="title">{kind.title}</p>
        <p className="message">{notice.message}</p>
      </div>

      <button type="button" className="close" aria-label="Dismiss" onClick={onDismiss}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {notice.kind === "pending" && <span className="waitBar" aria-hidden="true" />}

      <style jsx>{`
        .notice {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
          padding: 14px 36px 14px 14px;
          background:
            linear-gradient(135deg, ${kind.tint}, transparent 70%),
            var(--white);
          border: 1px solid #c9bfa0;
          border-left: 3px solid ${kind.accent};
          border-radius: 8px;
          box-shadow: 0 10px 28px -18px rgba(13, 30, 56, 0.45);
          overflow: hidden;
          animation: noticeIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }

        .notice.rejected,
        .notice.error {
          animation:
            noticeIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) backwards,
            noticeShake 0.4s 0.45s ease-in-out;
        }

        .badge {
          position: relative;
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${kind.tint};
          color: ${kind.accent};
          display: flex;
          align-items: center;
          justify-content: center;
          animation: badgePop 0.4s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1.4) backwards;
        }

        /* Soft ring that keeps pulsing while the request waits. */
        .pending .badge::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid ${kind.accent};
          animation: ringPulse 2s ease-out infinite;
        }

        .body {
          min-width: 0;
        }

        .eyebrowLine {
          display: block;
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: ${kind.accent};
          margin-bottom: 2px;
        }

        .title {
          font-family: "Space Grotesk", sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: var(--navy-deep);
          margin: 0 0 3px;
        }

        .message {
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-soft);
          margin: 0;
        }

        .close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 50%;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .close:hover {
          background: ${kind.tint};
          color: ${kind.accent};
        }

        /* Indeterminate "still waiting" bar along the bottom edge. */
        .waitBar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: ${kind.tint};
          overflow: hidden;
        }

        .waitBar::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 35%;
          background: linear-gradient(90deg, transparent, ${kind.accent}, transparent);
          animation: waitSlide 1.8s ease-in-out infinite;
        }

        @keyframes noticeIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        @keyframes noticeShake {
          20%, 60% {
            transform: translateX(-4px);
          }
          40%, 80% {
            transform: translateX(4px);
          }
        }

        @keyframes badgePop {
          from {
            transform: scale(0.4);
            opacity: 0;
          }
        }

        @keyframes ringPulse {
          from {
            transform: scale(1);
            opacity: 0.55;
          }
          to {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        @keyframes waitSlide {
          from {
            left: -35%;
          }
          to {
            left: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .notice,
          .notice.rejected,
          .notice.error,
          .badge,
          .pending .badge::after,
          .waitBar::after {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function NoticeIcon({ kind }: { kind: NoticeKind }) {
  if (kind === "pending") {
    // Hourglass that flips every couple of seconds.
    return (
      <svg className="hourglass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4" />
        <style jsx>{`
          .hourglass {
            animation: flip 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          }
          @keyframes flip {
            0%, 70% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(180deg);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .hourglass {
              animation: none;
            }
          }
        `}</style>
      </svg>
    );
  }

  if (kind === "rejected") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
