"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase only sends a couple of auth emails an hour, so "Resend" waits before unlocking.
const RESEND_COOLDOWN = 60;

const MAIL_PATHS = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </>
);

type Props = {
  open: boolean;
  onClose: () => void;
  /** Prefills the field, e.g. with whatever was already typed on the login form. */
  initialEmail?: string;
};

export default function ForgotPasswordModal({ open, onClose, initialEmail = "" }: Props) {
  // Mounting fresh on every open resets the form.
  return open ? <ForgotPasswordDialog onClose={onClose} initialEmail={initialEmail} /> : null;
}

function ForgotPasswordDialog({
  onClose,
  initialEmail,
}: {
  onClose: () => void;
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const backdrop = useBackdropDismiss(onClose);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendLink() {
    const trimmed = email.trim();
    if (!trimmed) return setError("Email address is required.");
    if (!EMAIL_RE.test(trimmed)) return setError("Enter a valid email address.");

    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);

    if (resetError) return setError(resetError.message);
    setSent(true);
    setCooldown(RESEND_COOLDOWN);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendLink();
  }

  function changeEmail() {
    setSent(false);
    setError("");
  }

  return (
    <div className="fpBackdrop" {...backdrop}>
      <form
        className="fpPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgotTitle"
        aria-describedby="forgotSub"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="fpTopBar">
          <span className="fpTopBarTitle mono">
            ACCOUNT RECOVERY / {sent ? "LINK SENT" : "RESET PASSWORD"}
          </span>
          <button type="button" className="fpClose" aria-label="Close" onClick={onClose}>
            <Icon size={16}>
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </button>
        </div>
        <div className="fpAccent" />

        {/* Keyed so the entrance animation replays when switching to the sent view. */}
        <div className="fpBody" key={sent ? "sent" : "form"}>
          <div className="fpIntro">
            <span className="fpHeroIcon" aria-hidden="true">
              {sent ? (
                <Icon size={22}>{MAIL_PATHS}</Icon>
              ) : (
                <Icon size={22}>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" />
                </Icon>
              )}
            </span>

            {sent ? (
              <>
                <h3 id="forgotTitle">Check your inbox</h3>
                <p id="forgotSub" className="fpSub">
                  If an account exists for <strong className="mono">{email.trim()}</strong>, a
                  reset link is on its way. It expires in 60 minutes, so check your spam folder if
                  it doesn&apos;t show up.
                </p>
                <p className="fpSwitch">
                  Wrong address?{" "}
                  <button type="button" className="fpLink" onClick={changeEmail}>
                    Use a different email
                  </button>
                </p>
              </>
            ) : (
              <>
                <h3 id="forgotTitle">Forgot your password?</h3>
                <p id="forgotSub" className="fpSub">
                  Enter the email linked to your account and we&apos;ll send you a link to set a
                  new one.
                </p>
              </>
            )}
          </div>

          {!sent && (
            <>
              <label htmlFor="forgotEmail">Email Address</label>
              <div className={`fpInputWrap${error ? " isInvalid" : ""}`}>
                <span className="fpInputIcon">
                  <Icon size={16}>{MAIL_PATHS}</Icon>
                </span>
                <input
                  id="forgotEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. lyarei@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "forgotError" : undefined}
                  autoFocus
                />
              </div>
            </>
          )}

          {error && (
            <p id="forgotError" className="fpError" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="fpFooter">
          <div className="fpActions">
            {sent ? (
              <>
                <button type="submit" className="btn ghost" disabled={loading || cooldown > 0}>
                  {loading ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
                </button>
                <button type="button" className="btn" onClick={onClose} autoFocus>
                  Back to log in
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      <style jsx>{`
        .fpBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          overflow-y: auto;
          background: rgba(13, 30, 56, 0.55);
          animation: fadeIn 0.15s ease backwards;
        }

        .fpPanel {
          width: 100%;
          max-width: 400px;
          margin: auto;
          overflow: hidden;
          background: var(--white);
          border: 1px solid var(--rule);
          border-radius: 8px;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          animation: popIn 0.2s ease backwards;
        }

        .fpTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px 10px 18px;
          background: var(--navy);
          border-bottom: 3px solid var(--orange);
        }

        .fpTopBarTitle {
          font-size: 11.5px;
          letter-spacing: 0.08em;
          color: var(--navy-tint);
        }

        .fpClose {
          display: flex;
          padding: 5px;
          border: none;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.12);
          color: var(--white);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .fpClose:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .fpClose:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 1px;
        }

        .fpAccent {
          height: 3px;
          background: var(--yellow);
        }

        .fpBody {
          padding: 24px 22px 20px;
          animation: fadeInUp 0.3s ease backwards;
        }

        .fpIntro {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .fpHeroIcon {
          width: 48px;
          height: 48px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s backwards;
        }

        .fpIntro h3 {
          font-size: 20px;
          margin-bottom: 6px;
        }

        .fpSub {
          margin-bottom: 18px;
          font-size: 13px;
          color: var(--ink-soft);
          overflow-wrap: anywhere;
        }

        .fpSub strong {
          font-size: 12px;
          font-weight: 500;
          color: var(--navy);
        }

        .fpInputWrap {
          position: relative;
        }

        .fpInputWrap input {
          margin-bottom: 0;
          padding-left: 38px;
        }

        .fpInputWrap.isInvalid input {
          border-color: var(--orange);
        }

        .fpInputIcon {
          position: absolute;
          top: 50%;
          left: 12px;
          display: flex;
          transform: translateY(-50%);
          color: var(--ink-soft);
          pointer-events: none;
        }

        .fpInputWrap:focus-within .fpInputIcon {
          color: var(--blue);
        }

        .fpError {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--orange);
          animation: fadeIn 0.2s ease backwards;
        }

        .fpFooter {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 12px;
          padding: 12px 22px;
          background: var(--vellum);
          border-top: 1px solid var(--rule);
        }

        .fpSwitch {
          margin: -6px 0 0;
          font-size: 12.5px;
          color: var(--ink-soft);
        }

        .fpLink {
          padding: 0;
          border: none;
          background: none;
          font: inherit;
          color: var(--blue);
          cursor: pointer;
        }

        .fpLink:hover {
          color: var(--navy);
          text-decoration: underline;
        }

        .fpActions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .fpActions .btn {
          padding: 8px 16px;
          font-size: 13.5px;
        }

        @media (max-width: 480px) {
          .fpBackdrop {
            padding: 12px;
          }

          .fpBody {
            padding: 20px 16px 18px;
          }

          .fpFooter {
            padding: 12px 16px;
          }

          .fpActions {
            width: 100%;
          }

          .fpActions .btn {
            flex: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fpBackdrop,
          .fpPanel,
          .fpBody,
          .fpHeroIcon,
          .fpError {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function Icon({ children, size }: { children: ReactNode; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
