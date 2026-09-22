"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { login } from "./actions";

type Fields = {
  email: string;
  studentId: string;
  password: string;
};

const EMPTY_FIELDS: Fields = {
  email: "",
  studentId: "",
  password: "",
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: Fields): Errors {
  const errors: Errors = {};

  if (!fields.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!fields.studentId.trim()) errors.studentId = "Student ID is required.";

  if (!fields.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export default function LoginForm() {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setGoogleLoading(false);
  }

  return (
    <div className="card">
      <div className="headRow">
        <div>
          <span className="eyebrow">LOG IN ACCOUNT</span>
          <h2>Welcome back</h2>
        </div>
        <span className="signupLine">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </span>
      </div>

      <form>
        <div className="field">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="e.g. lyarei@gmail.com"
            value={fields.email}
            onChange={(e) => setField("email", e.target.value)}
          />
          {errors.email && <p className="error">{errors.email}</p>}
        </div>

        {/* <div className="field">
          <label htmlFor="studentId">Student ID</label>
          <input
            id="studentId"
            type="text"
            placeholder="e.g. 20XX-XXXXX"
            value={fields.studentId}
            onChange={(e) => setField("studentId", e.target.value)}
          />
          {errors.studentId && <p className="error">{errors.studentId}</p>}
        </div> */}

        <div className="field">
          <div className="labelRow">
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="forgotLink"
              onClick={() => setForgotOpen(true)}
            >
              Forgot password?
            </button>
          </div>
          <div className="passField">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={fields.password}
              onChange={(e) => setField("password", e.target.value)}
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

        <button
          formAction={login}
          className="btn submitBtn"
          style={{ width: "100%", marginTop: 8 }}
        >
          Log in
        </button>
      </form>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />

      <div className="divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="btn googleBtn"
        style={{ width: "100%" }}
        onClick={handleGoogleLogin}
        disabled={googleLoading}
      >
        <GoogleIcon />
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <style jsx global>{`
        .split {
          height: 100vh;
          display: grid;
          grid-template-columns: 3fr 2fr;
          background: var(--vellum) url("/promo-bg.png") center center / cover no-repeat;
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
          font-family: "IBM Plex Mono", monospace;
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

        .card label {
          margin-bottom: 1px;
        }

        .card input {
          margin-bottom: 0;
        }

        .field {
          margin-bottom: 10px;
        }

        .field .error {
          margin-top: 6px;
          margin-bottom: 0;
        }

        .labelRow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }

        .labelRow label {
          margin-bottom: 0;
        }

        .forgotLink {
          background: none;
          border: none;
          padding: 0;
          font-size: 12.5px;
          color: var(--blue);
          cursor: pointer;
        }

        .forgotLink:hover {
          color: var(--navy);
          text-decoration: underline;
        }

        .formside h2 {
          font-size: 26px;
          margin-bottom: 4px;
        }

        .headRow {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0px;
          margin-bottom: 20px;
        }

        .signupLine {
          margin-top: -5px;
        }

        .headRow a {
          font-size: 13px;
          white-space: nowrap;
          color: #c86437;
        }

        .headRow a:hover {
          color: #a84f29;
        }

        .passField {
          position: relative;
        }

        .passField input {
          padding-right: 40px;
        }

        .toggleVis {
          position: absolute;
          right: 10px;
          top: 9px;
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--ink-soft);
          display: flex;
        }

        .toggleVis:hover {
          color: var(--navy);
        }

        .error {
          font-size: 12px;
          color: var(--orange);
          margin: 6px 0 0;
        }

        .formError {
          font-size: 13px;
          color: var(--orange);
          background: rgba(217, 83, 30, 0.08);
          border: 1px solid var(--orange);
          padding: 10px 12px;
          margin-bottom: 16px;
        }

        .submitBtn {
          background: #011f3b;
          border-color: #011f3b;
          color: var(--white);
        }

        .submitBtn:hover {
          background: #010f1e;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
          color: var(--ink-soft);
          font-size: 12px;
        }

        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #c9bfa0;
        }

        .googleBtn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: var(--white);
          color: var(--ink);
          border: 1px solid #c9bfa0;
        }

        .googleBtn:hover {
          background: var(--vellum-2);
        }

        .success {
          text-align: center;
        }

        .successIcon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin: 0 auto 18px;
        }

        @media (max-width: 860px) {
          .split {
            grid-template-columns: 1fr;
            align-content: start;
            height: auto;
            min-height: 100vh;
            overflow: visible;
            background: var(--vellum) url("/Background-Mobile.png") top center / 100% auto no-repeat;
          }

          .promo {
            justify-content: flex-start;
            padding: 18px 20px;
            aspect-ratio: 820 / 250;
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
            width: clamp(26px, 8vw, 40px);
            height: clamp(26px, 8vw, 40px);
          }

          .formside {
            padding: 32px 24px 40px;
          }
        }

        @media (max-width: 480px) {
          .formside {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.75l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
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
