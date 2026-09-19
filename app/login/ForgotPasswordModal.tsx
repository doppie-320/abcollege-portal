"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ForgotPasswordModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setError("");
      setLoading(false);
      setSent(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email address is required.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div
      className="modalOverlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modalPanel" role="dialog" aria-modal="true" aria-labelledby="forgotTitle">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {sent ? (
          <div className="modalSuccess">
            <div className="successIcon">✓</div>
            <h3 id="forgotTitle">Check your email</h3>
            <p className="modalSub">
              If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link to
              reset your password.
            </p>
            <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <span className="eyebrow">RESET PASSWORD</span>
            <h3 id="forgotTitle">Forgot your password?</h3>
            <p className="modalSub">
              Enter the email address linked to your account and we&apos;ll send you a link to
              reset your password.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="forgotEmail">Email Address</label>
                <input
                  id="forgotEmail"
                  type="email"
                  placeholder="e.g. lyarei@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                {error && <p className="error">{error}</p>}
              </div>

              <button
                type="submit"
                className="btn submitBtn"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>

      <style jsx>{`
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 30, 56, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 100;
        }

        .modalPanel {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          padding: 28px;
          box-shadow: 0 20px 50px rgba(13, 30, 56, 0.25);
        }

        .modalClose {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          font-size: 20px;
          line-height: 1;
          color: var(--ink-soft);
          cursor: pointer;
          border-radius: 4px;
        }

        .modalClose:hover {
          background: var(--vellum-2);
          color: var(--ink);
        }

        .modalPanel h3 {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .modalSub {
          font-size: 13px;
          color: var(--ink-soft);
          margin-bottom: 18px;
        }

        .field {
          margin-bottom: 15px;
        }

        .field label {
          margin-bottom: 4px;
        }

        .field input {
          margin-bottom: 0;
        }

        .error {
          font-size: 12px;
          color: var(--orange);
          margin: 6px 0 0;
        }

        .submitBtn {
          background: #011f3b;
          border-color: #011f3b;
          color: var(--white);
        }

        .submitBtn:hover {
          background: #010f1e;
        }

        .modalSuccess {
          text-align: center;
        }

        .modalSuccess .modalSub {
          margin-bottom: 20px;
        }

        .successIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin: 0 auto 14px;
        }
      `}</style>
    </div>
  );
}
