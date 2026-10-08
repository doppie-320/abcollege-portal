"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/profile/actions";

type Props = {
  initials: string;
  name: string;
  userId?: string;
  isProfilePage?: boolean;
  avatarUrl: string;
};

export default function UserMenu({ initials, name, userId, avatarUrl, isProfilePage = false }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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

  return (
    <div className="userMenu" ref={containerRef}>
      <button
        type="button"
        className="user-chip userMenuTrigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={30}
            height={30}
            className="size-[30px] shrink-0 rounded-full border border-navy-tint object-cover"
          />
        ) : (
          <span className="dot">{initials}</span>
        )}
        <span className="userMenuName">{name}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="userMenuPanel" id={panelId}>
          <Link
            href="/profile"
            className="userMenuItem"
            aria-current={isProfilePage ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <span className="userMenuItemFace">Student profile</span>
          </Link>

          <form action={logout} className="userMenuForm">
            <button type="submit" className="userMenuItem userMenuItemDanger">
              <span className="userMenuItemFace">Log out</span>
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .userMenu {
          position: relative;
        }

        .userMenuTrigger {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          cursor: pointer;
        }

        .userMenuTrigger:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 3px;
          border-radius: 6px;
        }

        .userMenuName {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .userMenuPanel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 60;
          width: 200px;
          display: flex;
          flex-direction: column;
          padding: 4px;
          background: var(--white);
          border: 1px solid var(--rule);
          border-radius: 6px;
          box-shadow: 0 10px 24px rgba(13, 30, 56, 0.16);
          transform-origin: top right;
          animation: popIn 0.12s ease backwards;
        }

        .userMenuForm {
          display: contents;
        }

        .userMenuItem {
          display: block;
          align-self: stretch;
          width: 100%;
          box-sizing: border-box;
          padding: 0;
          margin: 0;
          border: none;
          background: none;
          appearance: none;
          font: inherit;
          color: inherit;
          text-align: left;
          text-indent: 0;
          text-decoration: none;
          cursor: pointer;
        }

        .userMenuItem:focus {
          outline: none;
        }

        .userMenuItemFace {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          box-sizing: border-box;
          width: 100%;
          padding: 8px 10px;
          border-radius: 4px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--ink);
          transition: background 0.15s ease, color 0.15s ease;
        }

        .userMenuItem:hover .userMenuItemFace,
        .userMenuItem:focus-visible .userMenuItemFace {
          background: var(--vellum);
        }

        .userMenuItem:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .userMenuItem[aria-current='page'] .userMenuItemFace {
          color: var(--orange);
          font-weight: 600;
        }

        .userMenuItemDanger .userMenuItemFace {
          color: var(--orange);
        }

        .userMenuItemDanger:hover .userMenuItemFace,
        .userMenuItemDanger:focus-visible .userMenuItemFace {
          background: #fbe9e7;
        }
      `}</style>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
