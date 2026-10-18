"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";

export type LightboxImage = { src: string; alt: string };

// A horizontal drag at least this long flips to the next or previous image.
const SWIPE_PX = 50;

export default function ImageLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const hasMultiple = items.length > 1;
  const backdrop = useBackdropDismiss(onClose);
  const swipeStart = useRef<number | null>(null);
  const current = items[index];

  function step(by: number) {
    onIndexChange((index + by + items.length) % items.length);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" && !(hasMultiple && (e.key === "ArrowRight" || e.key === "ArrowLeft"))) return;
      // The viewer sits on top of other modals (a post, the composer preview); keep these keys from them.
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") onClose();
      else onIndexChange((index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length);
    }
    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, hasMultiple, items.length, onClose, onIndexChange]);

  return createPortal(
    <div
      className="lightboxBackdrop"
      {...backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={hasMultiple ? `Image ${index + 1} of ${items.length}` : "Image"}
    >
      <button type="button" className="lightboxClose" onClick={onClose} aria-label="Close image viewer">
        <CloseIcon />
      </button>

      {hasMultiple && (
        <button
          type="button"
          className="lightboxNav lightboxPrev"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
          aria-label="Previous image"
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      <div
        className="lightboxImageWrap"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          swipeStart.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipeStart.current === null || !hasMultiple) return;
          const dx = e.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {/* Plain <img>: post images come from Storage or any pasted URL, which next/image would have to allow-list. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={index} src={current.src} alt={current.alt} className="lightboxImg" draggable={false} />
        {hasMultiple && (
          <div className="lightboxCounter mono">
            {index + 1} / {items.length}
          </div>
        )}
      </div>

      {hasMultiple && (
        <button
          type="button"
          className="lightboxNav lightboxNext"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          aria-label="Next image"
        >
          <ChevronIcon direction="right" />
        </button>
      )}

      <style jsx>{`
        .lightboxBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 30, 56, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 300;
          animation: fadeIn 0.15s ease backwards;
        }

        .lightboxClose {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 1;
          background: rgba(255, 255, 255, 0.12);
          border: none;
          color: var(--white);
          padding: 8px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .lightboxClose:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .lightboxNav {
          position: absolute;
          top: 50%;
          z-index: 1;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.12);
          border: none;
          color: var(--white);
          padding: 10px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .lightboxNav:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .lightboxClose:focus-visible,
        .lightboxNav:focus-visible {
          outline: 2px solid var(--white);
          outline-offset: 2px;
        }

        .lightboxPrev {
          left: 20px;
        }

        .lightboxNext {
          right: 20px;
        }

        .lightboxImageWrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          /* Horizontal drags are ours (swipe); vertical scrolling and pinch-zoom stay with the browser. */
          touch-action: pan-y pinch-zoom;
        }

        .lightboxImg {
          display: block;
          max-width: 88vw;
          max-height: 78vh;
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 4px;
          user-select: none;
          animation: popIn 0.2s ease backwards;
        }

        .lightboxCounter {
          color: var(--white);
          font-size: 12.5px;
        }

        /* Phones: use the whole width for the photo and move the arrows down to the thumbs. */
        @media (max-width: 600px) {
          .lightboxBackdrop {
            padding: 56px 0 80px;
          }

          .lightboxImg {
            max-width: 100vw;
            max-height: calc(100dvh - 160px);
            border-radius: 0;
          }

          .lightboxClose {
            top: 12px;
            right: 12px;
          }

          .lightboxNav {
            top: auto;
            bottom: 20px;
            transform: none;
          }

          .lightboxPrev {
            left: calc(50% - 64px);
          }

          .lightboxNext {
            right: calc(50% - 64px);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direction === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}
