"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getAttendanceToken } from "./actions";
import { FIELD, Icon } from "./ui";

/** How often the code rotates; only drives the countdown ring. */
const TOKEN_PERIOD_MS = 30_000;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function StudentToken() {
  const [token, setToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [refreshAt, setRefreshAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);

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
      width: 480,
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

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

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
  const fraction = Math.min(1, (secondsLeft * 1000) / TOKEN_PERIOD_MS);

  return (
    <div>
      <div className="flex flex-col items-center">
        <div className="relative rounded-xl border border-rule bg-white p-2.5 shadow-[0_10px_28px_rgba(13,30,56,0.12)]">
          {/* Viewfinder corners */}
          <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-5 rounded-tl-lg border-t-[3px] border-l-[3px] border-orange" />
          <span className="pointer-events-none absolute -top-1.5 -right-1.5 size-5 rounded-tr-lg border-t-[3px] border-r-[3px] border-orange" />
          <span className="pointer-events-none absolute -bottom-1.5 -left-1.5 size-5 rounded-bl-lg border-b-[3px] border-l-[3px] border-orange" />
          <span className="pointer-events-none absolute -right-1.5 -bottom-1.5 size-5 rounded-br-lg border-r-[3px] border-b-[3px] border-orange" />

          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={qrUrl}
              src={qrUrl}
              alt="Your attendance QR code"
              width={240}
              height={240}
              className="animate-fade-in block size-[240px] max-w-full"
            />
          ) : (
            <div className="flex size-[240px] max-w-full animate-pulse items-center justify-center rounded-md bg-vellum-2 text-ink-soft">
              <Icon name="qr" size={40} />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 36 36" className="-rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--vellum-2)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--orange)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={ready ? RING_LENGTH * (1 - fraction) : RING_LENGTH}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div>
            <span className="mono block text-[10px] tracking-[0.08em] text-ink-soft uppercase">
              {ready ? "Refreshes in" : "Preparing pass"}
            </span>
            <span className="font-display block text-[20px] leading-tight font-semibold text-navy-deep tabular-nums">
              {ready ? `${secondsLeft}s` : "…"}
            </span>
          </div>
        </div>

        <p className="mt-3 mb-0 max-w-[290px] text-center text-[12.5px] text-ink-soft">
          Show this to a scanner. It changes every 30 seconds, so screenshots stop working.
        </p>
      </div>

      {token && (
        <details className="group mt-5 border-t border-rule-soft pt-3">
          <summary className="mono flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-blue hover:text-navy [&::-webkit-details-marker]:hidden">
            <span className="transition-transform duration-150 group-open:rotate-90">
              <Icon name="chevronRight" size={12} />
            </span>
            Show as text (for testing without a camera)
          </summary>
          <div className="animate-fade-in mt-3">
            <textarea
              readOnly
              rows={3}
              value={token}
              onFocus={(e) => e.target.select()}
              className={`${FIELD} resize-none font-mono text-[11px] leading-relaxed`}
            />
            <button
              type="button"
              className="btn ghost mt-2 rounded-lg px-3 py-1.5 text-xs"
              onClick={() => navigator.clipboard.writeText(token).then(() => setCopied(true))}
            >
              <Icon name={copied ? "check" : "copy"} size={13} />
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
