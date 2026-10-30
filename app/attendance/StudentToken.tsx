"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getAttendanceToken } from "./actions";
import { BLUEPRINT_GRID, Icon } from "./ui";

/** How often the code rotates; only drives the countdown ring. */
const TOKEN_PERIOD_MS = 30_000;
/** The countdown turns orange for the last few seconds. */
const ENDING_SECONDS = 5;
const EXIT_DURATION_MS = 220;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function StudentToken({ name, studentId }: { name: string; studentId: string }) {
  const [token, setToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [refreshAt, setRefreshAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [closing, setClosing] = useState(false);

  function closePass() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnlarged(false);
    } else {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setEnlarged(false);
      setClosing(false);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
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
  }, []);

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
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [refreshAt]);

  // The enlarged pass covers the page: lock scrolling and let Escape close it.
  useEffect(() => {
    if (!enlarged) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setEnlarged(false);
        } else {
          setClosing(true);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enlarged]);

  if (error) {
    return (
      <div
        role="alert"
        className="animate-fade-in flex items-start gap-3 rounded-lg border border-[#b3261e]/30 bg-[#fbe9e7] px-4 py-3 text-[13px] text-[#8f1e18]"
      >
        <span className="mt-0.5">
          <Icon name="alert" size={16} />
        </span>
        <div>
          <p className="mb-0.5 font-semibold">{error}</p>
          <p className="mono mb-0 text-[11px] opacity-80">Trying again in a few seconds…</p>
        </div>
      </div>
    );
  }

  const ready = Boolean(token && qrUrl);
  const ending = ready && secondsLeft <= ENDING_SECONDS;

  return (
    <div>
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => ready && setEnlarged(true)}
          disabled={!ready}
          aria-label="Enlarge your attendance QR code"
          className="group relative cursor-zoom-in rounded-xl border border-rule bg-white p-2.5 shadow-[0_10px_28px_rgba(13,30,56,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(13,30,56,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue disabled:cursor-default disabled:hover:translate-y-0"
        >
          <ViewfinderCorners />
          <QrImage url={qrUrl} ready={ready} size={240} />
          {ready && (
            <span className="mono pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-navy/90 px-1.5 py-1 text-[9.5px] text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Icon name="scan" size={10} />
              ENLARGE
            </span>
          )}
        </button>

        <Countdown ready={ready} secondsLeft={secondsLeft} ending={ending} />

        <p className="mt-3 mb-0 max-w-[290px] text-center text-[12.5px] text-ink-soft">
          Show this to a scanner. It changes every 30 seconds, so screenshots stop working.
        </p>

        {ready && (
          <button
            type="button"
            onClick={() => setEnlarged(true)}
            className="btn ghost mt-4 rounded-lg px-3.5 py-1.5 text-xs"
          >
            <Icon name="scan" size={13} />
            Show full screen
          </button>
        )}
      </div>

      {/* ───────── Full-screen pass ───────── */}
      {enlarged && ready && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attendance pass"
          onClick={closePass}
          className={`${closing ? "animate-fade-out" : "animate-fade-in"} fixed inset-0 z-[110] flex cursor-zoom-out flex-col items-center justify-center gap-5 bg-navy-deep/95 p-6 text-center backdrop-blur-sm ${BLUEPRINT_GRID}`}
        >
          <div className="animate-fade-in-up">
            <span className="mono text-[10px] tracking-[0.14em] text-navy-tint">ATTENDANCE PASS</span>
            <h2 className="mt-1 mb-0.5 text-[20px] text-paper sm:text-[22px]">{name}</h2>
            <p className="mono mb-0 text-[11px] text-navy-tint">{studentId}</p>
          </div>

          <div className="animate-pop-in relative rounded-2xl bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <ViewfinderCorners large />
            <QrImage url={qrUrl} ready size={340} />
          </div>

          <div className="animate-fade-in-up [animation-delay:0.08s]">
            <Countdown ready secondsLeft={secondsLeft} ending={ending} dark />
          </div>

          <p className="mono mb-0 max-w-[300px] text-[11px] leading-relaxed text-navy-tint">
            Turn your screen brightness up for faster scans.
            <br />
            Tap anywhere to close.
          </p>
        </div>
      )}
    </div>
  );
}

/** The QR image; re-keyed per code so each refresh pops in with a sheen. */
function QrImage({ url, ready, size }: { url: string; ready: boolean; size: number }) {
  if (!ready) {
    return (
      <div
        className="flex max-w-full animate-pulse items-center justify-center rounded-md bg-vellum-2 text-ink-soft"
        style={{ width: size, height: size }}
      >
        <Icon name="qr" size={40} />
      </div>
    );
  }

  return (
    <span key={url} className="relative block overflow-hidden rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Your attendance QR code"
        width={size}
        height={size}
        className="animate-pop-in block max-w-[min(100%,80vw)]"
        style={{ width: size, height: "auto" }}
      />
      <span className="animate-sheen pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-orange/20 to-transparent motion-reduce:hidden" />
    </span>
  );
}

const CORNERS = {
  small: [
    "-top-1.5 -left-1.5 rounded-tl-lg border-t-[3px] border-l-[3px] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5",
    "-top-1.5 -right-1.5 rounded-tr-lg border-t-[3px] border-r-[3px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
    "-bottom-1.5 -left-1.5 rounded-bl-lg border-b-[3px] border-l-[3px] group-hover:-translate-x-0.5 group-hover:translate-y-0.5",
    "-right-1.5 -bottom-1.5 rounded-br-lg border-r-[3px] border-b-[3px] group-hover:translate-x-0.5 group-hover:translate-y-0.5",
  ],
  large: [
    "-top-2 -left-2 rounded-tl-xl border-t-4 border-l-4",
    "-top-2 -right-2 rounded-tr-xl border-t-4 border-r-4",
    "-bottom-2 -left-2 rounded-bl-xl border-b-4 border-l-4",
    "-right-2 -bottom-2 rounded-br-xl border-r-4 border-b-4",
  ],
};

/** Orange scan brackets; they spread a little when the pass is hovered. */
function ViewfinderCorners({ large = false }: { large?: boolean }) {
  return (
    <>
      {CORNERS[large ? "large" : "small"].map((position) => (
        <span
          key={position}
          className={`pointer-events-none absolute border-orange transition-transform duration-200 ${large ? "size-8" : "size-5"} ${position}`}
        />
      ))}
    </>
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
          {ready ? (ending ? "New code in" : "Refreshes in") : "Preparing pass"}
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
