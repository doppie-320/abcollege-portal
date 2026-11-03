"use client";

import { useEffect, useId, useRef } from "react";
import type { Html5Qrcode } from "html5-qrcode";

function cameraError(err: unknown): string {
  const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/NotAllowed|Permission/i.test(message)) return "Camera permission was denied. Allow it in the browser's site settings.";
  if (/NotFound|Requested device not found/i.test(message)) return "No camera was found on this device.";
  if (/NotReadable|in use/i.test(message)) return "The camera is in use by another app.";
  return "Couldn't start the camera.";
}

/**
 * Live camera view that reports each QR code it reads. Stays mounted while
 * `active`; the parent decides which reads to act on.
 */
export default function CameraReader({
  active,
  onRead,
  onError,
  className,
}: {
  active: boolean;
  className?: string;
  onRead: (text: string) => void;
  onError: (message: string) => void;
}) {
  // html5-qrcode finds its container by id.
  const elementId = `camera-${useId().replace(/:/g, "")}`;
  // Callbacks change every render; read them through refs so the camera isn't restarted.
  const onReadRef = useRef(onRead);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadRef.current = onRead;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!active) return;

    if (!window.isSecureContext || !navigator.mediaDevices) {
      onErrorRef.current("The camera only works over HTTPS (or on localhost).");
      return;
    }

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const started = (async () => {
      // Imported here because the library touches `window` when it loads.
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode(elementId, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => onReadRef.current(text),
        // Called for every frame without a QR code; nothing to report.
        undefined,
      );
    })().catch((err) => {
      console.error("Camera failed to start:", err);
      if (!cancelled) onErrorRef.current(cameraError(err));
    });

    return () => {
      cancelled = true;
      // Wait for start() to settle; stopping a camera that is still starting throws.
      started.then(async () => {
        if (scanner?.isScanning) await scanner.stop();
        scanner?.clear();
      }).catch((err) => console.error("Camera failed to stop:", err));
    };
  }, [active, elementId]);

  return <div id={elementId} className={className} />;
}
