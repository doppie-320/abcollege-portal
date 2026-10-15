"use client";

import { useEffect, useState } from "react";
import { getAttendanceToken } from "./actions";

// Shows the token as text for now. Rendering it as a QR code (e.g. with the
// `qrcode` package) is the only change needed for phone scanning.
export default function StudentToken() {
  const [token, setToken] = useState("");
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
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [refreshAt]);

  if (error) return <p role="alert">{error}</p>;
  if (!token) return <p>Loading…</p>;

  return (
    <div>
      <p>Show this to a scanner. It changes every 30 seconds.</p>
      <p>
        <textarea readOnly rows={3} cols={60} value={token} onFocus={(e) => e.target.select()} />
      </p>
      <p>
        <button type="button" onClick={() => navigator.clipboard.writeText(token)}>Copy</button>{" "}
        Refreshes in {secondsLeft}s
      </p>
    </div>
  );
}
