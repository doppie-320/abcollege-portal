"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { MediaImage } from "@/lib/mock/social-db";

export default function ImageLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const hasMultiple = items.length > 1;
  const current = items[index];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && hasMultiple) onIndexChange((index + 1) % items.length);
      if (e.key === "ArrowLeft" && hasMultiple) onIndexChange((index - 1 + items.length) % items.length);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, hasMultiple, items.length, onClose, onIndexChange]);

  return (
    <div className="lightboxBackdrop" onClick={onClose}>
      <button type="button" className="lightboxClose" onClick={onClose} aria-label="Close image viewer">
        <CloseIcon />
      </button>

      {hasMultiple && (
        <button
          type="button"
          className="lightboxNav lightboxPrev"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + items.length) % items.length);
          }}
          aria-label="Previous image"
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      <div className="lightboxImageWrap" onClick={(e) => e.stopPropagation()}>
        <Image
          src={current.src}
          alt={current.alt}
          width={1200}
          height={800}
          style={{ maxWidth: "88vw", maxHeight: "78vh", width: "auto", height: "auto", objectFit: "contain", display: "block" }}
        />
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
            onIndexChange((index + 1) % items.length);
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
          background: rgba(13, 30, 56, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 200;
          animation: fadeIn 0.15s ease backwards;
        }

        .lightboxClose {
          position: absolute;
          top: 20px;
          right: 20px;
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
          transform: scale(1.1) rotate(90deg);
        }

        .lightboxNav {
          position: absolute;
          top: 50%;
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
          transform: translateY(-50%) scale(1.15);
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
          animation: popIn 0.2s ease backwards;
        }

        .lightboxCounter {
          color: var(--white);
          font-size: 12.5px;
        }
      `}</style>
    </div>
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
