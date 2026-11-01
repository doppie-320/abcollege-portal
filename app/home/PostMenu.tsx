"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";

const MENU_WIDTH = 160;

export default function PostMenu({
  onEdit,
  onDelete,
  noun = "post",
}: {
  // Each item is only shown when its handler is passed.
  onEdit?: () => void;
  onDelete?: () => void;
  // What the menu acts on, used in the labels ("Edit post", "Delete comment").
  noun?: string;
}) {
  // The menu goes in document.body so the comment list's scroll area can't clip it.
  const { triggerRef, place, open, show, hide } = useAnchoredPopover<HTMLButtonElement>({
    align: "end",
    width: MENU_WIDTH,
    minHeight: 100,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) hide();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") hide();
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, hide, triggerRef]);

  function choose(action: () => void) {
    hide();
    action();
  }

  return (
    <div className="postMenu">
      <button
        type="button"
        ref={triggerRef}
        className={`menuTrigger${open ? " open" : ""}`}
        onClick={() => (open ? hide() : show())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} options`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {place &&
        createPortal(
          <div
            className="menuPlace"
            style={{ left: place.left, top: place.top, width: place.width, transform: place.above ? "translateY(-100%)" : undefined }}
          >
            <div ref={menuRef} className={`menuDropdown${place.above ? " above" : ""}`} role="menu">
              {onEdit && (
                <button type="button" role="menuitem" className="menuItem" onClick={() => choose(onEdit)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit {noun}
                </button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" className="menuItem danger" onClick={() => choose(onDelete)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
                  </svg>
                  Delete {noun}
                </button>
              )}
            </div>
          </div>,
          document.body,
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

        /* Placed by useAnchoredPopover; above the post modal (z-index 100). */
        .menuPlace {
          position: fixed;
          z-index: 150;
        }

        .menuDropdown {
          padding: 4px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          box-shadow: 0 10px 24px rgba(13, 30, 56, 0.16);
          transform-origin: top right;
          animation: popIn 0.12s ease backwards;
        }

        .menuDropdown.above {
          transform-origin: bottom right;
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
