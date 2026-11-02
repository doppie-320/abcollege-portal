"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import { getStaticPass, resetMyStaticPass } from "./actions";
import { FullScreenPass, PassQrButton } from "./PassQr";
import { ICON_PATHS, Icon } from "./ui";

const ALT = "Your attendance pass";

function drawPass(pass: string): Promise<string> {
  // More error correction than the live code: it's meant to survive printing.
  return QRCode.toDataURL(pass, {
    errorCorrectionLevel: "Q",
    margin: 4,
    width: 640,
    color: { dark: "#0d1e38", light: "#ffffff" },
  });
}

/**
 * The student's main pass: a QR that doesn't change, so it can be saved or
 * printed. Events can turn it off to require the live code instead; see StudentToken.
 */
export default function StaticPass({ name, studentId }: { name: string; studentId: string }) {
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [enlarged, setEnlarged] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const closeFullScreen = useCallback(() => setEnlarged(false), []);

  // The pass doesn't change until it's reset, so it's fetched once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const result = await getStaticPass();
        if (cancelled) return;
        if (result.error !== undefined) throw new Error(result.error);
        const url = await drawPass(result.data.pass);
        if (cancelled) return;
        setError("");
        setQrUrl(url);
      } catch (err) {
        console.error("Couldn't load the attendance pass:", err);
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : "Couldn't load your attendance pass.");
        // e.g. while offline.
        timer = setTimeout(load, 10_000);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  async function reset() {
    const result = await resetMyStaticPass();
    // ConfirmDialog shows its error message when this throws.
    if (result.error !== undefined) throw new Error(result.error);
    setQrUrl(await drawPass(result.data.pass));
    setResetDone(true);
    setConfirmingReset(false);
  }

  if (error && !qrUrl) {
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

  return (
    <div>
      <div className="flex flex-col items-center">
        <PassQrButton url={qrUrl} alt={ALT} size={240} onEnlarge={() => setEnlarged(true)} />

        <p className="mt-5 mb-0 max-w-[290px] text-center text-[12.5px] text-ink-soft">
          Show this to a scanner. It never changes, so you can save or print it. Anyone with a copy can check in as you,
          so don&apos;t share it.
        </p>

        {resetDone && (
          <p role="status" className="mt-3 mb-0 text-center text-[12px] font-medium text-blue">
            New pass ready. Old copies no longer work.
          </p>
        )}

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
            <button type="button" onClick={() => setConfirmingReset(true)} className="btn ghost rounded-lg px-3 py-1.5 text-xs">
              <Icon name="x" size={13} />
              Reset pass
            </button>
          </div>
        )}
      </div>

      {enlarged && qrUrl && (
        <FullScreenPass name={name} studentId={studentId} url={qrUrl} alt={ALT} onClose={closeFullScreen} />
      )}

      {confirmingReset && (
        <ConfirmDialog
          tone="warning"
          eyebrow="RESET · ATTENDANCE PASS"
          icon={ICON_PATHS.id}
          title="Reset your attendance pass?"
          message="Every saved, printed or shared copy stops working. Do this if you lost a printout or someone else has your pass."
          confirmLabel="Reset pass"
          busyLabel="Resetting…"
          errorMessage="Couldn't reset your pass. Please try again."
          onCancel={() => setConfirmingReset(false)}
          onConfirm={reset}
        />
      )}
    </div>
  );
}
