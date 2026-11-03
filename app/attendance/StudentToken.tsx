"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { getAttendanceToken } from "./actions";
import { FullScreenPass, PassQrButton } from "./PassQr";
import { Icon } from "./ui";

/** How often the code rotates; only drives the countdown ring. */
const TOKEN_PERIOD_MS = 30_000;
/** The countdown turns orange for the last few seconds. */
const ENDING_SECONDS = 5;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const ALT = "Your live attendance code";

/**
 * The rotating code, for events that turn off static passes. Collapsed by
 * default so the static pass stays the obvious one to show; it only fetches
 * codes while open.
 */
export default function StudentToken({ name, studentId }: { name: string; studentId: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [refreshAt, setRefreshAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const closeFullScreen = useCallback(() => setEnlarged(false), []);

  function toggle() {
    // Drop the old code so reopening never flashes an expired one.
    if (open) {
      setToken("");
      setQrUrl("");
      setError("");
    }
    setOpen(!open);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      const result = await getAttendanceToken();
      if (cancelled) return;

      if (result.error !== undefined) {
        setError(result.error);
        setToken("");
        // Retry less often after a failure, e.g. while offline.
        timer = setTimeout(load, 10_000);
        return;
      }

      setError("");
      setToken(result.data.token);
      setRefreshAt(Date.now() + result.data.refreshInMs);
      timer = setTimeout(load, result.data.refreshInMs);
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // A wide quiet zone and medium error correction scan reliably off a phone screen.
    QRCode.toDataURL(token, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 640,
      color: { dark: "#0d1e38", light: "#ffffff" },
    })
      .then((url) => !cancelled && setQrUrl(url))
      .catch((err) => {
        console.error("Couldn't draw the attendance QR code:", err);
        if (!cancelled) setQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [open, refreshAt]);

  const ready = Boolean(token && qrUrl);
  const ending = ready && secondsLeft <= ENDING_SECONDS;

  return (
    <div className="mt-6 border-t border-rule-soft pt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-none bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
      >
        <span>
          <span className="mono block text-[10px] tracking-[0.1em] text-ink-soft uppercase">Scanner asks for it?</span>
          <span className="block text-[13.5px] font-semibold text-navy-deep">Live code</span>
        </span>
        <span className={`text-ink-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {open && (
        <div className="animate-fade-in mt-3">
          <p className="mb-4 text-[12.5px] text-ink-soft">
            Some events only take this code. It changes every 30 seconds, so screenshots and printouts stop working.
          </p>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-[#b3261e]/30 bg-[#fbe9e7] px-4 py-3 text-[13px] text-[#8f1e18]"
            >
              <span className="mt-0.5">
                <Icon name="alert" size={16} />
              </span>
              <div>
                <p className="mb-0.5 font-semibold">{error}</p>
                <p className="mono mb-0 text-[11px] opacity-80">Trying again in a few seconds…</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <PassQrButton url={ready ? qrUrl : ""} alt={ALT} size={200} onEnlarge={() => setEnlarged(true)} />
              <Countdown ready={ready} secondsLeft={secondsLeft} ending={ending} />
            </div>
          )}
        </div>
      )}

      {enlarged && ready && (
        <FullScreenPass name={name} studentId={studentId} url={qrUrl} alt={ALT} onClose={closeFullScreen}>
          <Countdown ready secondsLeft={secondsLeft} ending={ending} dark />
        </FullScreenPass>
      )}
    </div>
  );
}

function Countdown({
  ready,
  secondsLeft,
  ending,
  dark = false,
}: {
  ready: boolean;
  secondsLeft: number;
  ending: boolean;
  dark?: boolean;
}) {
  const fraction = Math.min(1, (secondsLeft * 1000) / TOKEN_PERIOD_MS);

  return (
    <div className="mt-5 flex items-center gap-3">
      <svg width="38" height="38" viewBox="0 0 36 36" className="-rotate-90" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke={dark ? "rgba(255,255,255,0.15)" : "var(--vellum-2)"}
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke={ending ? "var(--orange)" : dark ? "var(--grid)" : "var(--navy)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={ready ? RING_LENGTH * (1 - fraction) : RING_LENGTH}
          className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear"
        />
      </svg>
      <div className="text-left">
        <span className={`mono block text-[10px] tracking-[0.08em] uppercase ${dark ? "text-navy-tint" : "text-ink-soft"}`}>
          {ready ? (ending ? "New code in" : "Refreshes in") : "Preparing code"}
        </span>
        <span
          className={`font-display block text-[20px] leading-tight font-semibold tabular-nums transition-colors duration-300 ${
            ending ? "text-orange" : dark ? "text-paper" : "text-navy-deep"
          }`}
        >
          {ready ? `${secondsLeft}s` : "…"}
        </span>
      </div>
    </div>
  );
}
