"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { isRichText, layoutBodyImages, sanitizeRichText } from "@/lib/richText";
import ImageLightbox from "./ImageLightbox";

// Bodies taller than this are clipped in the feed until "Show more" is clicked.
const COLLAPSED_HEIGHT = 420;
// Height of the fade-out at the bottom of a clipped body.
const FADE_HEIGHT = 96;

export default function RichTextBody({ content, collapsible = false }: { content: string; collapsible?: boolean }) {
  const rich = isRichText(content);
  const { html, images } = useMemo(
    () => (rich ? layoutBodyImages(sanitizeRichText(content)) : { html: "", images: [] }),
    [rich, content]
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [clipHeight, setClipHeight] = useState(COLLAPSED_HEIGHT);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!collapsible || !body) return;
    // Re-measure as images and videos load in.
    const observer = new ResizeObserver(() => {
      // Photos that start above the fold are shown whole instead of being cut through.
      const media = body.querySelector<HTMLElement>(".imageGallery, img, video");
      const limit =
        media && media.offsetTop < COLLAPSED_HEIGHT
          ? Math.max(COLLAPSED_HEIGHT, media.offsetTop + media.offsetHeight + FADE_HEIGHT)
          : COLLAPSED_HEIGHT;
      setClipHeight(limit);
      setOverflows(body.scrollHeight > limit + 80);
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [collapsible, html]);

  const collapsed = collapsible && overflows && !expanded;

  // Images are plain HTML, so one listener on the body opens whichever was picked.
  function imageIndex(target: EventTarget) {
    const el = (target as HTMLElement).closest<HTMLElement>("[data-lightbox-index]");
    return el ? Number(el.dataset.lightboxIndex) : null;
  }

  function onBodyClick(e: MouseEvent) {
    const index = imageIndex(e.target);
    if (index !== null) setLightboxIndex(index);
  }

  function onBodyKeyDown(e: KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const index = imageIndex(e.target);
    if (index === null) return;
    e.preventDefault();
    setLightboxIndex(index);
  }

  return (
    <div className="bodyWrap">
      <div className={`clip${collapsed ? " collapsed" : ""}`} style={collapsed ? { maxHeight: clipHeight } : undefined}>
        {rich ? (
          <div
            ref={bodyRef}
            className="richText"
            // offsetTop of images inside is measured from here.
            style={{ position: "relative" }}
            onClick={onBodyClick}
            onKeyDown={onBodyKeyDown}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div ref={bodyRef} className="richText plain">
            {content}
          </div>
        )}
      </div>

      {collapsible && overflows && (
        <button type="button" className="toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {lightboxIndex !== null && images[lightboxIndex] && (
        <ImageLightbox
          items={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      <style jsx>{`
        .clip.collapsed {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - ${FADE_HEIGHT}px), transparent);
          mask-image: linear-gradient(to bottom, #000 calc(100% - ${FADE_HEIGHT}px), transparent);
        }

        .toggle {
          margin-top: 6px;
          background: none;
          border: none;
          padding: 2px 0;
          font-family: "IBM Plex Mono", monospace;
          font-size: 11.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--blue);
          cursor: pointer;
        }

        .toggle:hover {
          color: var(--navy);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .toggle:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
