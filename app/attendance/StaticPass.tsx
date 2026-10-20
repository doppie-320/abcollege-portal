"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import { getStaticPass, resetMyStaticPass } from "./actions";
import { ICON_PATHS, Icon } from "./ui";

function drawPass(pass: string): Promise<string> {
  // Larger and with more error correction than the live code: it's meant to survive printing.
  return QRCode.toDataURL(pass, {
    errorCorrectionLevel: "Q",
    margin: 4,
    width: 640,
    color: { dark: "#0d1e38", light: "#ffffff" },
  });
}

/**
 * The student's static pass: a QR that doesn't change, for printing or showing
 * without data. Only events that allow static passes accept it. Collapsed by
 * default so the live code stays the obvious one to show.
 */
export default function StaticPass({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Fetched the first time the panel opens; the pass doesn't change until it's reset.
  useEffect(() => {
    if (!open || qrUrl) return;
    let cancelled = false;
    getStaticPass()
      .then(async (result) => {
        if (cancelled) return;
        if (result.error !== undefined) {
          setError(result.error);
          return;
        }
        const url = await drawPass(result.data.pass);
        if (!cancelled) setQrUrl(url);
      })
      .catch((err) => {
        console.error("Couldn't load the static pass:", err);
        if (!cancelled) setError("Couldn't load your static pass. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, qrUrl]);

  async function reset() {
    const result = await resetMyStaticPass();
    // ConfirmDialog shows its error message when this throws.
    if (result.error !== undefined) throw new Error(result.error);
    setQrUrl(await drawPass(result.data.pass));
    setResetDone(true);
    setConfirmingReset(false);
  }

  return (
    <div className="mt-6 border-t border-rule-soft pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-none bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
      >
        <span>
          <span className="mono block text-[10px] tracking-[0.1em] text-ink-soft uppercase">No data at the event?</span>
          <span className="block text-[13.5px] font-semibold text-navy-deep">Static pass</span>
        </span>
        <span className={`text-ink-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {open && (
        <div className="animate-fade-in mt-3">
          <p className="mb-3 text-[12.5px] text-ink-soft">
            A code that never changes, so you can print it or save it. Only events that allow static passes accept it.
            Anyone with a copy can check in as you, so don&apos;t share it.
          </p>

          {error ? (
            <p role="alert" className="mb-0 rounded-md border border-[#b3261e]/30 bg-[#fbe9e7] px-3 py-2 text-[12.5px] text-[#8f1e18]">
              {error}
            </p>
          ) : !qrUrl ? (
            <div className="mx-auto flex size-[180px] animate-pulse items-center justify-center rounded-md bg-vellum-2 text-ink-soft">
              <Icon name="id" size={32} />
            </div>
          ) : (
            <>
              <div className="mx-auto w-fit rounded-lg border border-dashed border-navy/40 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={qrUrl} src={qrUrl} alt="Your static attendance pass" width={180} height={180} className="animate-pop-in block" />
              </div>
              {resetDone && (
                <p role="status" className="mt-3 mb-0 text-center text-[12px] font-medium text-blue">
                  New pass ready. Old copies no longer work.
                </p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <a
                  href={qrUrl}
                  download={`attendance-pass-${studentId.replace(/[^\w-]+/g, "_")}.png`}
                  className="btn ghost rounded-lg px-3 py-1.5 text-xs no-underline"
                >
                  <Icon name="download" size={13} />
                  Save image
                </a>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="btn ghost rounded-lg px-3 py-1.5 text-xs"
                >
                  <Icon name="x" size={13} />
                  Reset pass
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {confirmingReset && (
        <ConfirmDialog
          tone="warning"
          eyebrow="RESET · STATIC PASS"
          icon={ICON_PATHS.id}
          title="Reset your static pass?"
          message="Every saved, printed or shared copy stops working. Do this if you lost a printout or someone else has your pass. Your live QR code isn't affected."
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
