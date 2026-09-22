"use client";

import { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | Option)[];
  placeholder?: string;
  "aria-label"?: string;
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
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalized = normalize(options);
  const selected = normalized.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function selectOption(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="selectPicker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="selectTrigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? "selectValue" : "selectPlaceholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul className="selectDropdown" role="listbox">
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
        </ul>
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

        .selectDropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          width: 100%;
          min-width: 180px;
          max-height: 220px;
          overflow-y: auto;
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
          padding: 8px 10px;
          border: none;
          background: none;
          border-radius: 5px;
          font-family: "Inter", sans-serif;
          font-size: 13.5px;
          color: var(--ink);
          cursor: pointer;
        }

        .selectOption:hover {
          background: var(--vellum-2);
        }

        .selectOptionActive,
        .selectOptionActive:hover {
          background: var(--navy);
          color: var(--white);
        }
      `}</style>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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
