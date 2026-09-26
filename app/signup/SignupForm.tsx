"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/components/DatePicker";
import Select from "@/components/Select";
import { register } from "./actions";

type Course = {
  id: number;
  name: string;
};

type YearLevel = {
  id: number;
  name: string;
};

type SignupFormProps = {
  courses: Course[];
  yearLevels: YearLevel[];
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  birthday: string;
  birthdayConsent: boolean;
  yearLevel: string;
  program: string;
  password: string;
  confirmPassword: string;
};

const EMPTY_FIELDS: Fields = {
  firstName: "",
  lastName: "",
  email: "",
  studentId: "",
  birthday: "",
  birthdayConsent: false,
  yearLevel: "",
  program: "",
  password: "",
  confirmPassword: "",
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: Fields): Errors {
  const errors: Errors = {};

  if (!fields.firstName.trim()) errors.firstName = "First name is required.";
  if (!fields.lastName.trim()) errors.lastName = "Last name is required.";

  if (!fields.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!fields.studentId.trim()) errors.studentId = "Student ID is required.";

  if (fields.birthday && new Date(fields.birthday) > new Date()) {
    errors.birthday = "Birthday can't be in the future.";
  }

  if (!fields.yearLevel) errors.yearLevel = "Select a year level.";
  if (!fields.program) errors.program = "Select a program.";

  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

type GoogleFields = {
  studentId: string;
  yearLevel: string;
  program: string;
  birthday: string;
  birthdayConsent: boolean;
};

const EMPTY_GOOGLE_FIELDS: GoogleFields = {
  studentId: "",
  yearLevel: "",
  program: "",
  birthday: "",
  birthdayConsent: false,
};

type GoogleErrors = Partial<Record<keyof GoogleFields, string>>;

function validateGoogleFields(fields: GoogleFields): GoogleErrors {
  const errors: GoogleErrors = {};

  if (!fields.studentId.trim()) errors.studentId = "Student ID is required.";
  if (!fields.yearLevel) errors.yearLevel = "Select a year level.";
  if (!fields.program) errors.program = "Select a program.";

  if (fields.birthday && new Date(fields.birthday) > new Date()) {
    errors.birthday = "Birthday can't be in the future.";
  }

  return errors;
}

type Step = "form" | "googleDetails" | "googleConfirm";

export default function SignupForm({courses, yearLevels,}: SignupFormProps) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [googleFields, setGoogleFields] = useState<GoogleFields>(EMPTY_GOOGLE_FIELDS);
  const [googleErrors, setGoogleErrors] = useState<GoogleErrors>({});
  const [googleLoading, setGoogleLoading] = useState(false);

  const courseOptions = courses.map((course) => ({
    value: String(course.id),
    label: course.name,
  }));

  const yearLevelsOptions = yearLevels.map((yearLevel) => ({
    value: String(yearLevel.id),
    label: yearLevel.name,
  }));

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function setGoogleField<K extends keyof GoogleFields>(key: K, value: GoogleFields[K]) {
    setGoogleFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(fields);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      const formData = new FormData(event.currentTarget);

      formData.set("yearLevelId", fields.yearLevel);
      formData.set("courseId", fields.program);

      await register(formData);      

      setSubmitted(true);
    }
  }

  function handleGoogleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateGoogleFields(googleFields);
    setGoogleErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep("googleConfirm");
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    try {
      sessionStorage.setItem(
        "pendingSignupProfile",
        JSON.stringify({
          studentId: googleFields.studentId.trim(),
          yearLevel: googleFields.yearLevel,
          program: googleFields.program,
          birthday: googleFields.birthday || null,
          birthdayConsent: googleFields.birthday ? googleFields.birthdayConsent : false,
        }),
      );
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — proceed without it.
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setGoogleLoading(false);
  }

  const googleConfirmDisabled =
    googleLoading || (Boolean(googleFields.birthday) && !googleFields.birthdayConsent);

  return (
    <>
      {submitted ? (
        <div className="success">
          <div className="successIcon">✓</div>
          <h2>Request submitted</h2>
          <p className="mono" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            A council admin will review your details and approve your account.
            You&apos;ll get an email at <strong>{fields.email}</strong> once it&apos;s ready.
          </p>
          <button
            type="button"
            className="btn ghost"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              setFields(EMPTY_FIELDS);
              setErrors({});
              setSubmitted(false);
            }}
          >
            Back to form
          </button>
        </div>
      ) : step === "googleDetails" ? (
        <div className="card">
          <div className="headRow headRowCompact">
            <div>
              <span className="eyebrow">CONTINUE WITH GOOGLE</span>
              <h2>A few more details</h2>
            </div>
          </div>
          <p className="stepHint">
            Google will handle your name, email, and password. We still need these to
            set up your student profile.
          </p>

          <form onSubmit={handleGoogleDetailsSubmit} noValidate>
            <div className="field">
              <label htmlFor="gStudentId">Student ID</label>
              <input
                id="gStudentId"
                type="text"
                placeholder="e.g. SOE12345678"
                value={googleFields.studentId}
                onChange={(e) => setGoogleField("studentId", e.target.value)}
              />
              {googleErrors.studentId && <p className="error">{googleErrors.studentId}</p>}
            </div>

            <div className="fieldRow">
              <div className="field fieldNarrow">
                <label htmlFor="gYearLevel">Year Level</label>
                <Select
                  id="gYearLevel"
                  value={googleFields.yearLevel}
                  onChange={(v) => setGoogleField("yearLevel", v)}
                  options={yearLevelsOptions}
                  placeholder="Select Year Level"
                />
                {googleErrors.yearLevel && <p className="error">{googleErrors.yearLevel}</p>}
              </div>
              <div className="field fieldWide">
                <label htmlFor="gProgram">Program</label>
                <Select
                  id="gProgram"
                  value={googleFields.program}
                  onChange={(v) => setGoogleField("program", v)}
                  options={courseOptions}
                  placeholder="Select program"
                />
                {googleErrors.program && <p className="error">{googleErrors.program}</p>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="gBirthday">
                Birthday <span className="optionalTag">(optional)</span>
              </label>
              <DatePicker
                id="gBirthday"
                value={googleFields.birthday}
                onChange={(v) => setGoogleField("birthday", v)}
                placeholder="Select date"
                max={TODAY_ISO}
              />
              {googleErrors.birthday && <p className="error">{googleErrors.birthday}</p>}
              <p className="fieldHint">
                Leave blank if you&apos;d rather not share it — you&apos;ll confirm how
                it&apos;s used on the next step.
              </p>
            </div>

            <div className="stepActions">
              <button type="button" className="btn ghost" onClick={() => setStep("form")}>
                Back
              </button>
              <button type="submit" className="btn submitBtn" style={{ flex: 1 }}>
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : step === "googleConfirm" ? (
        <div className="card">
          <div className="headRow">
            <div>
              <span className="eyebrow">REVIEW &amp; CONFIRM</span>
              <h2>Confirm your details</h2>
            </div>
          </div>

          <ul className="summaryList">
            <li>
              <span>Student ID</span>
              <strong>{googleFields.studentId}</strong>
            </li>
            <li>
              <span>Year Level</span>
              <strong>{googleFields.yearLevel}</strong>
            </li>
            <li>
              <span>Program</span>
              <strong>{googleFields.program}</strong>
            </li>
            <li>
              <span>Birthday</span>
              <strong>{googleFields.birthday || "Not shared"}</strong>
            </li>
          </ul>

          {googleFields.birthday && (
            <label className="consentRow">
              <input
                type="checkbox"
                checked={googleFields.birthdayConsent}
                onChange={(e) => setGoogleField("birthdayConsent", e.target.checked)}
              />
              <span>
                I consent to my birthday being visible on the SOE Hub shared calendar
                (e.g. for birthday shoutouts). Leaving this unchecked keeps it private.
              </span>
            </label>
          )}

          <div className="stepActions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setStep("googleDetails")}
            >
              Back
            </button>
            <button
              type="button"
              className="btn submitBtn"
              style={{ flex: 1 }}
              onClick={handleGoogleSignup}
              disabled={googleConfirmDisabled}
            >
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="headRow">
            <div>
              <span className="eyebrow">CREATE ACCOUNT</span>
              <h2>Request an account</h2>
            </div>
            <span className="loginLine">
              Already have an account? <Link href="/login">Log in</Link>
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="fieldRow">
              <div className="field">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="e.g. Iya"
                  value={fields.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                />
                {errors.firstName && <p className="error">{errors.firstName}</p>}
              </div>
              <div className="field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="e.g. Rei"
                  value={fields.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
                {errors.lastName && <p className="error">{errors.lastName}</p>}
              </div>
            </div>

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

            <div className="fieldRow">
              <div className="field">
                <label htmlFor="yearLevel">Year Level</label>
                <Select
                  id="yearLevel"
                  value={fields.yearLevel}
                  onChange={(v) => setField("yearLevel", v)}
                  options={yearLevelsOptions}
                  placeholder="Select Year Level"
                />
                {errors.yearLevel && <p className="error">{errors.yearLevel}</p>}
              </div>
              <div className="field">
                <label htmlFor="birthday">
                  Birthday <span className="optionalTag">(optional)</span>
                </label>
                <DatePicker
                  id="birthday"
                  value={fields.birthday}
                  onChange={(v) => setField("birthday", v)}
                  placeholder="Select date"
                  max={TODAY_ISO}
                />
                {errors.birthday && <p className="error">{errors.birthday}</p>}
              </div>
            </div>

            {fields.birthday && (
              <label className="consentRow">
                <input
                  type="checkbox"
                  checked={fields.birthdayConsent}
                  onChange={(e) => setField("birthdayConsent", e.target.checked)}
                />
                <span>
                  I consent to my birthday being visible on the SOE Hub shared calendar
                  (e.g. for birthday shoutouts). Leaving this unchecked keeps it private.
                </span>
              </label>
            )}

            <div className="field">
              <label htmlFor="studentId">Student ID</label>
              <input
                id="studentId"
                name="studentId"
                type="text"
                placeholder="e.g. SOE12345678"
                value={fields.studentId}
                onChange={(e) => setField("studentId", e.target.value)}
              />
              {errors.studentId && <p className="error">{errors.studentId}</p>}
            </div>

            <div className="field">
              <label htmlFor="program">Program</label>
              <Select
                id="program"
                value={fields.program}
                onChange={(v) => setField("program", v)}
                options={courseOptions}
                placeholder="Select program"
              />
              {errors.program && <p className="error">{errors.program}</p>}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
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

            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="passField">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Enter the same password"
                  value={fields.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
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
              {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              className="btn submitBtn"
              style={{ width: "100%", marginTop: 8 }}
            >
              Request account
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn googleBtn"
            style={{ width: "100%" }}
            onClick={() => setStep("googleDetails")}
          >
            <GoogleIcon />
            Sign up with Google
          </button>
        </div>
      )}

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
          margin-bottom: 4px;
        }

        .card input,
        .card select {
          margin-bottom: 0;
        }

        .field {
          margin-bottom: 4px;
        }

        .field .error {
          margin-top: 6px;
          margin-bottom: 0;
        }

        .optionalTag {
          font-weight: 400;
          color: var(--ink-soft);
          font-size: 11.5px;
        }

        .fieldHint {
          font-size: 11.5px;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        .consentRow {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 400;
          color: var(--ink-soft);
          margin: 2px 0 12px;
          cursor: pointer;
        }

        .consentRow input {
          margin: 2px 0 0;
          width: auto;
          flex-shrink: 0;
        }

        .stepHint {
          font-size: 13px;
          color: var(--ink-soft);
          margin-bottom: 18px;
        }

        .stepActions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .summaryList {
          list-style: none;
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 16px;
          background: var(--white);
        }

        .summaryList li {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          font-size: 13px;
        }

        .summaryList li + li {
          border-top: 1px solid #e4dcc9;
        }

        .summaryList li span {
          color: var(--ink-soft);
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

        .headRowCompact {
          margin-bottom: 0px;
        }

        .loginLine {
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

        .fieldRow {
          display: flex;
          gap: 16px;
        }

        .fieldRow > .field {
          flex: 1;
          min-width: 0;
          margin-bottom: 4px;
        }

        .fieldRow > .fieldNarrow {
          flex: 0 0 130px;
        }

        .fieldRow > .fieldWide {
          flex: 1;
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

        @media (max-width: 1024px), (orientation: portrait) {
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
          .fieldRow {
            flex-direction: column;
            gap: 0;
          }

          .formside {
            padding: 20px 16px;
          }
        }
      `}</style>
    </>
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
