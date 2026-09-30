"use client";

import { useEffect, useRef, useState } from "react";

export default function PostMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="postMenu" ref={wrapRef}>
      <button
        type="button"
        className={`menuTrigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div className="menuDropdown" role="menu">
          <button type="button" role="menuitem" className="menuItem" onClick={() => choose(onEdit)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit post
          </button>
          <button type="button" role="menuitem" className="menuItem danger" onClick={() => choose(onDelete)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
            </svg>
            Delete post
          </button>
        </div>
      )}

      <style jsx>{`
        .postMenu {
          position: relative;
          align-self: flex-start;
          flex-shrink: 0;
        }

        .menuTrigger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          background: none;
          border: 1px solid transparent;
          border-radius: 4px;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .menuTrigger:hover,
        .menuTrigger.open {
          background: var(--vellum-2);
          color: var(--navy);
        }

        .menuTrigger.open {
          border-color: #c9bfa0;
        }

        .menuTrigger:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        .menuDropdown {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 160px;
          padding: 4px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          box-shadow: 0 10px 24px rgba(13, 30, 56, 0.16);
          z-index: 20;
          transform-origin: top right;
          animation: popIn 0.12s ease backwards;
        }

        .menuItem {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          background: none;
          border: none;
          border-radius: 4px;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          color: var(--ink);
          text-align: left;
          cursor: pointer;
        }

        .menuItem:hover,
        .menuItem:focus-visible {
          background: var(--vellum);
          outline: none;
        }

        .menuItem.danger {
          color: #b3261e;
        }

        .menuItem.danger:hover,
        .menuItem.danger:focus-visible {
          background: #fbe9e7;
        }
      `}</style>
    </div>
  );
}
