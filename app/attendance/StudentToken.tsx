"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getAttendanceToken } from "./actions";

export default function StudentToken() {
  const [token, setToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [refreshAt, setRefreshAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

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
    QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 4, width: 320 })
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

  if (error) return <p role="alert">{error}</p>;
  if (!token) return <p>Loading…</p>;

  return (
    <div>
      <p>Show this to a scanner. It changes every 30 seconds, so screenshots stop working.</p>
      {qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrUrl} alt="Your attendance QR code" width={320} height={320} />
      ) : (
        <p>Drawing QR code…</p>
      )}
      <p>Refreshes in {secondsLeft}s</p>
      <details>
        <summary>Show as text (for testing without a camera)</summary>
        <p>
          <textarea readOnly rows={3} cols={60} value={token} onFocus={(e) => e.target.select()} />
        </p>
        <button type="button" onClick={() => navigator.clipboard.writeText(token)}>Copy</button>
      </details>
    </div>
  );
}
