"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Errors = { password?: string; confirm?: string };

function validate(password: string, confirm: string): Errors {
  const errors: Errors = {};

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!confirm) {
    errors.confirm = "Please confirm your password.";
  } else if (confirm !== password) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(password, confirm);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("password update failed:", error);
      setLoading(false);
      setFormError(
        error.code === "same_password"
          ? "Your new password must be different from your current one."
          : error.code === "weak_password"
            ? error.message
            : "Couldn't update your password. Please try again, or request a new reset link.",
      );
      return;
    }

    // Log in again with the new password, which also runs the admin MFA step.
    await supabase.auth.signOut();
    setPassword("");
    setConfirm("");
    setLoading(false);
    setDone(true);
  }

  return (
    <>
      {done ? (
        <div className="card success" role="status">
          <div className="successIcon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </div>
          <span className="eyebrow">ACCOUNT RECOVERY</span>
          <h2>Password updated</h2>
          <p className="lead">You can now log in with your new password.</p>
          <Link href="/login" className="btn submitBtn doneBtn">
            Back to log in
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="headRow">
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h2>Set a new password</h2>
          </div>

          {formError && (
            <p className="formError" role="alert">
              {formError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="newPassword">New Password</label>
              <div className="passField">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggleVis"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password && <p className="error">{errors.password}</p>}
            </div>

            <div className="field">
              <label htmlFor="confirmNewPassword">Confirm Password</label>
              <div className="passField">
                <input
                  id="confirmNewPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter the same password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="toggleVis"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {errors.confirm && <p className="error">{errors.confirm}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn submitBtn"
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        </div>
      )}

      {/* The page's split layout, same as the login and verify forms. */}
      <style jsx global>{`
        .split {
          height: 100vh;
          display: grid;
          grid-template-columns: 3fr 2fr;
          background: var(--vellum) url("/promo-bg.svg") center center / cover no-repeat;
        }

        .promo {
          color: var(--white);
          padding: 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .seal {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          object-fit: contain;
        }

        .promo h1 {
          color: var(--white);
          font-size: 44px;
          line-height: 1.08;
          max-width: 9.5em;
          margin-top: auto;
        }

        .promo .sub {
          color: #afc2dc;
          font-size: 15px;
          max-width: 32em;
          margin-top: 18px;
        }

        .promo .footMono {
          font-family: "DM Mono", monospace;
          font-size: 11.5px;
          color: #6e86a8;
          margin-top: 48px;
        }

        .brandText {
          display: inline;
        }

        .formside {
          padding: 32px 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          justify-content: safe center;
          align-items: center;
          overflow-y: auto;
        }

        .card {
          width: 100%;
          max-width: 360px;
        }

        .formside h2 {
          font-size: 26px;
          margin-bottom: 4px;
        }

        @media (max-width: 1024px), (orientation: portrait) {
          .split {
            grid-template-columns: 1fr;
            align-content: start;
            height: auto;
            min-height: 100vh;
            overflow: visible;
            background: var(--vellum) url("/Background-Mobile.svg") top center / 130% auto no-repeat;
          }

          .promo {
            justify-content: flex-start;
            aspect-ratio: 820 / 305;
            padding: max(16px, 5vw);
          }

          .promo h1,
          .promo .sub,
          .footMono,
          .brandText {
            display: none;
          }

          .promo .brand {
            gap: 0;
          }

          .seal {
            width: clamp(40px, 12vw, 64px);
            height: clamp(40px, 12vw, 64px);
          }

          .formside {
            padding: 32px 24px 40px;
          }

          .formside h2 {
            font-size: 24px;
          }
        }

        @media (min-width: 600px) and (max-width: 1024px) {
          .split {
            grid-template-columns: 2fr 3fr;
            align-content: stretch;
            height: 100vh;
            height: 100dvh;
            min-height: 0;
            background: var(--vellum) url("/promo-bg.svg") calc(38vw - 106.8vh) 0 / auto 100% no-repeat;
            background-position-x: calc(38vw - 106.8dvh);
          }

          .promo {
            aspect-ratio: auto;
            padding: 32px;
          }

          .seal {
            width: 64px;
            height: 64px;
          }

          .formside {
            padding: 32px 32px 32px 0;
          }
        }

        @media (max-width: 480px) {
          .formside {
            padding: 20px 16px;
          }

          .formside h2 {
            font-size: 22px;
          }
        }
      `}</style>

      <style jsx>{`
        .headRow {
          margin-bottom: 20px;
        }

        .field {
          margin-bottom: 10px;
        }

        .field label {
          margin-bottom: 1px;
        }

        .field input {
          margin-bottom: 0;
          padding-right: 40px;
        }

        .passField {
          position: relative;
        }

        .toggleVis {
          position: absolute;
          right: 10px;
          top: 9px;
          display: flex;
          padding: 4px;
          border: none;
          background: none;
          color: var(--ink-soft);
          cursor: pointer;
        }

        .toggleVis:hover {
          color: var(--navy);
        }

        .error {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--orange);
        }

        .formError {
          margin-bottom: 16px;
          padding: 10px 12px;
          border: 1px solid var(--orange);
          border-radius: 5px;
          background: rgba(217, 83, 30, 0.08);
          font-size: 13px;
          color: var(--orange);
        }

        .submitBtn {
          background: #011f3b;
          border-color: #011f3b;
          color: var(--white);
        }

        .submitBtn:hover {
          background: #010f1e;
        }

        .success {
          text-align: center;
        }

        .successIcon {
          width: 48px;
          height: 48px;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
        }

        .lead {
          margin: 0 0 18px;
          font-size: 13.5px;
          color: var(--ink-soft);
        }

        .success :global(.doneBtn) {
          display: block;
          width: 100%;
          text-align: center;
          text-decoration: none;
          background: #011f3b;
          border-color: #011f3b;
          color: var(--white);
        }

        .success :global(.doneBtn:hover) {
          background: #010f1e;
          color: var(--white);
        }
      `}</style>
    </>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.32 20.32 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
