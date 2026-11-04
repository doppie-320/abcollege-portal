"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OFFLINE_ERROR, settle } from "@/lib/actionResult";
import { sendVerificationCode, verifyCode } from "./actions";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

// How long each moment stays on screen.
const SUCCESS_MS = 2400;
const SHAKE_MS = 600;

// Frontend only: stands in for the real check. Any other code shows the incorrect state.
type SendResult = Awaited<ReturnType<typeof sendVerificationCode>>;

async function requestCode(isResend: boolean): Promise<SendResult> {
  try {
    return await sendVerificationCode(isResend);
  } catch (cause) {
    console.error("[verify] request failed:", cause);
    return { cooldown: 0, error: OFFLINE_ERROR }
  }
}

type Status = "entering" | "checking" | "incorrect" | "success";

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name[0]}${"•".repeat(Math.max(name.length - 1, 2))}@${domain}`;
}

export default function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("entering");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const [resendCount, setResendCount] = useState(0);
  const [codeError, setCodeError] = useState("");
  const [sendError, setSendError] = useState("");

  const checking = status === "checking";
  const incorrect = status === "incorrect";
  // Also held while a wrong code is still shaking, right before it clears.
  const locked = checking || (incorrect && code !== "");

  const applySendResult = useCallback((result: SendResult) => {
    if (result.redirecTo) {
      router.replace(result.redirecTo);
      return;
    }
    setSendError(result.error ?? "");
    setCooldown(result.cooldown);
  }, [router]);

  useEffect(() => {
    let current = true;
    requestCode(false).then((result) => {
      if (current) applySendResult(result);
    });
    return () => {
      current = false;
    };
  }, [applySendResult]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (!checking) return;
    let current = true;
    settle(verifyCode(code)).then((result) => {
      if (!current) return;
      setCodeError(result.error ?? "");
      setStatus(result.error ? "incorrect" : "success");
    });
    return () => {
      current = false;
    };
  }, [checking, code]);

  useEffect(() => {
    if (!incorrect || code === "") return;
    const id = setTimeout(() => {
      setCode("");
      inputRef.current?.focus();
    }, SHAKE_MS);
    return () => clearTimeout(id);
  }, [incorrect, code]);

  useEffect(() => {
    if (status !== "success") return;
    const id = setTimeout(() => router.replace("/home"), SUCCESS_MS);
    return () => clearTimeout(id);
  }, [status, router]);

  // cacheComponents keeps this component alive when you leave the page, so
  // start over on the way out instead of coming back to an old attempt.
  useEffect(() => {
    return () => {
      setCode("");
      setStatus("entering");
      setCooldown(RESEND_COOLDOWN);
      setResendCount(0);
    };
  }, []);

  function handleChange(value: string) {
    const next = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    setStatus(next.length === CODE_LENGTH ? "checking" : "entering");
  }

  async function handleResend() {
    setCode("");
    setStatus("entering");
    setSendError("");
    setCooldown(RESEND_COOLDOWN);
    inputRef.current?.focus();

    const result = await requestCode(true);
    applySendResult(result);
    if (result.sent) setResendCount((n) => n + 1);
  }

  return (
    <>
      {status === "success" ? (
        <div className="card verified" role="status">
          <div className="verifiedSeal" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle className="sealDisc" cx="60" cy="60" r="42" />
              <circle className="sealStroke" cx="60" cy="60" r="42" />
              <path className="sealCheck" d="M42 61 L55 74 L80 47" />
            </svg>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="sealSpark" style={{ "--i": i } as CSSProperties} />
            ))}
          </div>

          <span className="eyebrow verifiedEyebrow">VERIFIED</span>
          <h2>You&apos;re all set</h2>
          <p className="lead">Taking you to your portal…</p>
          <span className="loadBar" aria-hidden="true" />
        </div>
      ) : (
        <div className="card">
          <div className="intro">
            {/* Keyed so a resend plays the "sent" animation again. */}
            <span key={resendCount} className="mailIcon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </span>
            <span className="eyebrow">TWO-FACTOR VERIFICATION</span>
            <h2>Check your email</h2>
            <p className="lead">
              {resendCount > 0 ? "A new verification code" : "A verification code"} was sent to{" "}
              <strong className="mono">{maskEmail(email)}</strong>
            </p>
          </div>

          <label htmlFor="verifyCode" className="codeLabel">
            Enter verification code
          </label>

          <div className={`codeField${checking ? " isChecking" : ""}${incorrect ? " isIncorrect" : ""}`}>
            {/* One real input over the boxes, so paste, backspace and the phone's
                "from Messages/Mail" autofill all work without per-box handling. */}
            <input
              ref={inputRef}
              id="verifyCode"
              className="codeInput"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              readOnly={locked}
              onChange={(e) => handleChange(e.target.value)}
              aria-invalid={incorrect ? true : undefined}
              aria-describedby="verifyHint"
            />
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`digit${code[i] ? " isFilled" : ""}${i === code.length ? " isNext" : ""}`}
                style={{ "--i": i } as CSSProperties}
                aria-hidden="true"
              >
                {code[i] && (
                  <span className="digitHop">
                    <span className="digitValue">{code[i]}</span>
                  </span>
                )}
              </span>
            ))}
          </div>

          {incorrect || sendError ? (
            <p id="verifyHint" className="hint isError" role="alert">
              {incorrect ? codeError : sendError}
            </p>
          ) : (
            <p id="verifyHint" className="hint" aria-live="polite">
              {checking ? "Checking your code…" : `Enter the ${CODE_LENGTH}-digit code from the email.`}
            </p>
          )}

          <hr className="hairline" />

          <div className="footRow">
            <span>
              Didn&apos;t get it?{" "}
              <button
                type="button"
                className="resend"
                onClick={handleResend}
                disabled={cooldown > 0 || checking}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </span>
            <Link href="/login">Back to log in</Link>
          </div>
        </div>
      )}

      {/* The page's split layout, same as the login and sign-up forms. */}
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
        .intro,
        .verified {
          text-align: center;
        }

        .intro {
          margin-bottom: 20px;
        }

        .eyebrow {
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .lead {
          margin: 0;
          font-size: 13.5px;
          color: var(--ink-soft);
          overflow-wrap: anywhere;
        }

        .lead strong {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--navy);
        }

        /* ---------- Envelope: lands, then sends out two soft rings ---------- */
        .mailIcon {
          position: relative;
          width: 48px;
          height: 48px;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        .mailIcon::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid var(--orange);
          opacity: 0;
          animation: ring 1.4s 0.3s ease-out 2;
        }

        /* The new-mail dot. */
        .mailIcon::after {
          content: "";
          position: absolute;
          top: 1px;
          right: 1px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--orange);
          border: 2px solid var(--vellum);
          animation: pop 0.35s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        /* ---------- Code boxes ---------- */
        .codeLabel {
          margin-bottom: 6px;
        }

        .codeField {
          position: relative;
          display: grid;
          grid-template-columns: repeat(${CODE_LENGTH}, 1fr);
          gap: 8px;
        }

        .codeField.isIncorrect {
          animation: shake 0.4s ease-in-out;
        }

        /* Invisible, but it's what actually takes the focus and the typing.
           16px keeps iOS from zooming in on focus. */
        .codeInput {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          border: none;
          background: transparent;
          box-shadow: none;
          outline: none;
          font-size: 16px;
          color: transparent;
          caret-color: transparent;
          cursor: text;
        }

        .codeInput::selection {
          background: transparent;
          color: transparent;
        }

        .codeInput:focus {
          border: none;
          box-shadow: none;
          outline: none;
        }

        .digit {
          position: relative;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--rule);
          border-radius: 6px;
          background: var(--white);
          box-shadow: inset 2px 2px 6px rgba(28, 35, 51, 0.1);
          font-family: "DM Mono", monospace;
          font-size: 22px;
          font-weight: 500;
          color: var(--navy-deep);
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
          animation: rise 0.35s calc(var(--i) * 35ms) cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }

        .digit.isFilled {
          border-color: var(--navy);
          box-shadow: 0 2px 0 var(--navy);
        }

        .codeInput:focus ~ .digit.isNext {
          border-color: var(--navy);
          box-shadow: 0 0 0 3px rgba(19, 42, 77, 0.1);
        }

        /* Stand-in for the hidden input's caret. */
        .codeInput:focus ~ .digit.isNext::after {
          content: "";
          width: 2px;
          height: 22px;
          background: var(--orange);
          animation: blink 1s steps(2, jump-none) infinite;
        }

        .digitHop,
        .digitValue {
          display: block;
        }

        .digitValue {
          animation: pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        /* Checking: the digits hop in a wave. */
        .isChecking .digit {
          background: var(--vellum);
        }

        .isChecking .digitHop {
          animation: hop 0.9s calc(var(--i) * 80ms) ease-in-out infinite;
        }

        .isIncorrect .digit {
          border-color: #b3261e;
          background: rgba(179, 38, 30, 0.06);
          box-shadow: none;
          color: #b3261e;
        }

        .hint {
          margin: 8px 0 0;
          font-size: 12.5px;
          color: var(--ink-soft);
        }

        .hint.isError {
          font-weight: 500;
          color: #b3261e;
        }

        .hairline {
          margin: 18px 0 14px;
        }

        .footRow {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 6px 12px;
          font-size: 12.5px;
          color: var(--ink-soft);
        }

        .footRow :global(a) {
          color: #c86437;
        }

        .footRow :global(a:hover) {
          color: #a84f29;
        }

        .resend {
          padding: 0;
          border: none;
          background: none;
          font: inherit;
          color: var(--blue);
          cursor: pointer;
        }

        .resend:hover:not(:disabled) {
          color: var(--navy);
          text-decoration: underline;
        }

        .resend:disabled {
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          cursor: default;
        }

        /* ---------- Success: same seal as a finished sign-up ---------- */
        .verified > * {
          animation: rise 0.45s 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }

        .verifiedSeal {
          position: relative;
          width: 96px;
          height: 96px;
          margin: 0 auto 14px;
          animation: pop 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }

        .verifiedSeal svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .sealDisc {
          fill: var(--navy);
          transform-origin: 60px 60px;
          animation: pop 0.5s 0.1s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }

        .sealStroke {
          fill: none;
          stroke: var(--orange);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 264;
          stroke-dashoffset: 264;
          transform: rotate(-90deg);
          transform-origin: 60px 60px;
          animation: draw 0.7s 0.15s ease-out forwards;
        }

        .sealCheck {
          fill: none;
          stroke: var(--white);
          stroke-width: 6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: draw 0.35s 0.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .sealSpark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 3px;
          height: 9px;
          margin: -4.5px 0 0 -1.5px;
          border-radius: 2px;
          background: var(--orange);
          opacity: 0;
          animation: spark 0.6s 0.7s ease-out forwards;
        }

        .sealSpark:nth-of-type(even) {
          background: var(--navy);
          height: 6px;
        }

        .verifiedEyebrow {
          color: var(--orange);
        }

        /* Indeterminate: the wait is however long the next page takes. */
        .loadBar {
          position: relative;
          display: block;
          width: 160px;
          height: 3px;
          margin: 16px auto 0;
          border-radius: 3px;
          background: var(--vellum-2);
          overflow: hidden;
        }

        .loadBar::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 40%;
          border-radius: 3px;
          background: var(--orange);
          animation: slide 1.1s ease-in-out infinite;
        }

        @keyframes rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
        }

        @keyframes pop {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
        }

        @keyframes ring {
          from {
            transform: scale(1);
            opacity: 0.6;
          }
          to {
            transform: scale(1.7);
            opacity: 0;
          }
        }

        @keyframes blink {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes hop {
          0%, 50%, 100% {
            transform: none;
          }
          25% {
            transform: translateY(-5px);
          }
        }

        @keyframes shake {
          20%, 60% {
            transform: translateX(-6px);
          }
          40%, 80% {
            transform: translateX(6px);
          }
        }

        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes spark {
          0% {
            opacity: 0;
            transform: rotate(calc(var(--i) * 45deg)) translateY(-36px) scaleY(0.4);
          }
          40% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: rotate(calc(var(--i) * 45deg)) translateY(-56px) scaleY(1);
          }
        }

        @keyframes slide {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(250%);
          }
        }

        @media (max-width: 480px) {
          .codeField {
            gap: 6px;
          }

          .digit {
            height: 48px;
            font-size: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mailIcon,
          .mailIcon::before,
          .mailIcon::after,
          .codeField.isIncorrect,
          .digit,
          .digitValue,
          .isChecking .digitHop,
          .verified > *,
          .verifiedSeal,
          .sealDisc,
          .sealStroke,
          .sealCheck,
          .loadBar::after {
            animation: none;
          }

          .sealStroke,
          .sealCheck {
            stroke-dashoffset: 0;
          }

          .sealSpark {
            display: none;
          }

          .loadBar::after {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
