"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isRichText, sanitizeRichText } from "@/lib/richText";

// Bodies taller than this are clipped in the feed until "Show more" is clicked.
const COLLAPSED_HEIGHT = 420;

export default function RichTextBody({ content, collapsible = false }: { content: string; collapsible?: boolean }) {
  const rich = isRichText(content);
  const html = useMemo(() => (rich ? sanitizeRichText(content) : ""), [rich, content]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!collapsible || !body) return;
    // Re-measure as images and videos load in.
    const observer = new ResizeObserver(() => setOverflows(body.scrollHeight > COLLAPSED_HEIGHT + 80));
    observer.observe(body);
    return () => observer.disconnect();
  }, [collapsible, html]);

  const collapsed = collapsible && overflows && !expanded;

  return (
    <div className="bodyWrap">
      <div className={`clip${collapsed ? " collapsed" : ""}`}>
        {rich ? (
          <div ref={bodyRef} className="richText" dangerouslySetInnerHTML={{ __html: html }} />
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

      <style jsx>{`
        .clip.collapsed {
          max-height: ${COLLAPSED_HEIGHT}px;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, #000 75%, transparent);
          mask-image: linear-gradient(to bottom, #000 75%, transparent);
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
