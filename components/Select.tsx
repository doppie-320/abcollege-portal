"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";

const DROPDOWN_MAX_HEIGHT = 220;

type Option = { value: string; label: ReactNode };

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | Option)[];
  placeholder?: string;
  "aria-label"?: string;
  compact?: boolean;
  inTable?: boolean;
};

function normalize(options: (string | Option)[]): Option[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  "aria-label": ariaLabel,
  compact = false,
  inTable = false,
}: Props) {
  // The list goes in document.body so a modal or scroll area around the trigger can't clip it.
  const { triggerRef, place, open, show, hide } = useAnchoredPopover<HTMLButtonElement>({ gap: 10 });
  const dropdownRef = useRef<HTMLUListElement>(null);
  const normalized = normalize(options);
  const selected = normalized.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) hide();
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

  function selectOption(v: string) {
    onChange(v);
    hide();
  }

  return (
    <div className="selectPicker">
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={
          `selectTrigger${compact ? " compact" : ""}${inTable ? " row" : ""}`
        }
        onClick={() => (open ? hide() : show())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? "selectValue" : "selectPlaceholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon open={open} size={inTable ? 14 : 16} />
      </button>

      {place && createPortal(
        <ul
          ref={dropdownRef}
          className="selectDropdown"
          role="listbox"
          style={{
            left: place.left,
            top: place.top,
            width: place.width,
            maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, place.maxHeight),
            transform: place.above ? "translateY(-100%)" : undefined,
          }}
        >
          {normalized.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={
                  "selectOption" + (opt.value === value ? " selectOptionActive" : "")
                }
                onClick={() => selectOption(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}

      <style jsx>{`
        .selectPicker {
          position: relative;
        }

        .selectTrigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border: 1px solid #c9bfa0;
          border-radius: 5px;
          background: var(--white);
          padding: 11px 12px;
          font-family: "Inter", sans-serif;
          font-size: 14px;
          color: var(--ink);
          box-shadow: inset 3px 3px 10px rgba(28, 35, 51, 0.14);
          cursor: pointer;
          text-align: left;
        }

        .selectTrigger:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        .selectTrigger.compact {
          padding: 6px 10px;
          font-size: 12.5px;
          box-shadow: none;
        }

        .selectTrigger.row {
          box-sizing: border-box;
          height: var(--control-h);
          padding: 8px 12px;
          font-size: 13px;
        }

        .selectValue {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selectPlaceholder {
          color: var(--ink-soft);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selectTrigger svg {
          flex-shrink: 0;
          color: var(--ink-soft);
          transition: transform 0.15s ease;
        }

        /* Placed by useAnchoredPopover; above the modals (z-index 100–110) it may open in. */
        .selectDropdown {
          position: fixed;
          z-index: 150;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          overflow-y: auto;
          margin: 0;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 16px 36px rgba(13, 30, 56, 0.2);
          padding: 6px;
          list-style: none;
        }

        .selectOption {
          width: 100%;
          text-align: left;
          padding: 6px 8px;
          border: none;
          background: none;
          border-radius: 5px;
          font-family: "Inter", sans-serif;
          font-size: 13.5px;
          color: var(--ink);
          cursor: pointer;
          overflow-wrap: anywhere;
          gap: 6px;
        }

        .selectOption:hover {
          background: rgba(19, 42, 77, 0.05);
        }

        .selectOptionActive,
        .selectOptionActive:hover {
          background: #e6f3ff;
          color: var(--ink);
        }

      `}</style>
    </div>
  );
}

function ChevronIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
