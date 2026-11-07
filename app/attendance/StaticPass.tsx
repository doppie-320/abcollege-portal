"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { FullScreenPass, PassQrButton } from "./PassQr";
import { Icon } from "./ui";

const ALT = "Your attendance pass";

/**
 * The student's main pass: their school ID as a QR, so it never changes and
 * can be printed and laminated. Events can turn it off to require the live
 * code instead; see StudentToken.
 */
export default function StaticPass({ name, studentId }: { name: string; studentId: string }) {
  const [qrUrl, setQrUrl] = useState("");
  const [enlarged, setEnlarged] = useState(false);
  const closeFullScreen = useCallback(() => setEnlarged(false), []);

  useEffect(() => {
    let cancelled = false;
    // More error correction than the live code: it's meant to survive printing.
    QRCode.toDataURL(studentId, {
      errorCorrectionLevel: "Q",
      margin: 4,
      width: 640,
      color: { dark: "#0d1e38", light: "#ffffff" },
    })
      .then((url) => !cancelled && setQrUrl(url))
      .catch((err) => console.error("Couldn't draw the attendance pass:", err));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div>
      <div className="flex flex-col items-center">
        <PassQrButton url={qrUrl} alt={ALT} size={240} onEnlarge={() => setEnlarged(true)} />

        <p className="mt-5 mb-0 max-w-[290px] text-center text-[12.5px] text-ink-soft">
          Show this clearly to an officer for scanning.
        </p>

        {qrUrl && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setEnlarged(true)} className="btn ghost rounded-lg px-3 py-1.5 text-xs">
              <Icon name="scan" size={13} />
              Full screen
            </button>
            <a
              href={qrUrl}
              download={`attendance-pass-${studentId.replace(/[^\w-]+/g, "_")}.png`}
              className="btn ghost rounded-lg px-3 py-1.5 text-xs no-underline"
            >
              <Icon name="download" size={13} />
              Save image
            </a>
          </div>
        )}
      </div>

      {enlarged && qrUrl && (
        <FullScreenPass name={name} studentId={studentId} url={qrUrl} alt={ALT} onClose={closeFullScreen} />
      )}
    </div>
  );
}
