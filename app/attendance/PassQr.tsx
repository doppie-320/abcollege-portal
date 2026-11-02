"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BLUEPRINT_GRID, Icon } from "./ui";

const EXIT_DURATION_MS = 220;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The pass's QR, framed with scan brackets; tapping it opens the full-screen view. */
export function PassQrButton({
  url,
  alt,
  size,
  onEnlarge,
}: {
  url: string;
  alt: string;
  size: number;
  onEnlarge: () => void;
}) {
  const ready = Boolean(url);

  return (
    <button
      type="button"
      onClick={() => ready && onEnlarge()}
      disabled={!ready}
      aria-label={`Enlarge ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`}
      className="group relative cursor-zoom-in rounded-xl border border-rule bg-white p-2.5 shadow-[0_10px_28px_rgba(13,30,56,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(13,30,56,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue disabled:cursor-default disabled:hover:translate-y-0"
    >
      <ViewfinderCorners />
      <QrImage url={url} alt={alt} size={size} />
      {ready && (
        <span className="mono pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-navy/90 px-1.5 py-1 text-[9.5px] text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="scan" size={10} />
          ENLARGE
        </span>
      )}
    </button>
  );
}

/**
 * The pass covering the whole page, for scanning. Locks scrolling; Escape or a
 * tap anywhere closes it. `children` go under the QR.
 */
export function FullScreenPass({
  name,
  studentId,
  url,
  alt,
  onClose,
  children,
}: {
  name: string;
  studentId: string;
  url: string;
  alt: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [closing, setClosing] = useState(false);

  function close() {
    if (closing) return;
    if (prefersReducedMotion()) onClose();
    else setClosing(true);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (prefersReducedMotion()) onClose();
      else setClosing(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attendance pass"
      onClick={close}
      className={`${closing ? "animate-fade-out" : "animate-fade-in"} fixed inset-0 z-[110] flex cursor-zoom-out flex-col items-center justify-center gap-5 bg-navy-deep/95 p-6 text-center backdrop-blur-sm ${BLUEPRINT_GRID}`}
    >
      <div className="animate-fade-in-up">
        <span className="mono text-[10px] tracking-[0.14em] text-navy-tint">ATTENDANCE PASS</span>
        <h2 className="mt-1 mb-0.5 text-[20px] text-paper sm:text-[22px]">{name}</h2>
        <p className="mono mb-0 text-[11px] text-navy-tint">{studentId}</p>
      </div>

      <div className="animate-pop-in relative rounded-2xl bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <ViewfinderCorners large />
        <QrImage url={url} alt={alt} size={340} />
      </div>

      {children && <div className="animate-fade-in-up [animation-delay:0.08s]">{children}</div>}

      <p className="mono mb-0 max-w-[300px] text-[11px] leading-relaxed text-navy-tint">
        Turn your screen brightness up for faster scans.
        <br />
        Tap anywhere to close.
      </p>
    </div>
  );
}

/** The QR image, or a placeholder while it loads; re-keyed per code so each new one pops in with a sheen. */
function QrImage({ url, alt, size }: { url: string; alt: string; size: number }) {
  if (!url) {
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
        alt={alt}
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
