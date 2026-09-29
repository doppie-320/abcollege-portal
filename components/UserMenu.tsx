"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/profile/actions";
import { useAvatarValue } from "@/lib/avatar";

type Props = {
  initials: string;
  name: string;
  userId?: string;
  isProfilePage?: boolean;
};

export default function UserMenu({ initials, name, userId, isProfilePage = false }: Props) {
  const avatarUrl = useAvatarValue(userId);
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
          {isProfilePage ? (
            <span className="userMenuItem userMenuItemCurrent" aria-current="page">
              Student profile
            </span>
          ) : (
            <Link
              href="/profile"
              className="userMenuItem"
              onClick={() => setOpen(false)}
            >
              Student profile
            </Link>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="userMenuItem userMenuItemDanger"
            >
              Log out
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

        .userMenuName {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .userMenuPanel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          z-index: 60;
          min-width: 190px;
          display: flex;
          flex-direction: column;
          padding: 6px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 16px 36px rgba(13, 30, 56, 0.2);
        }

        .userMenuItem {
          display: block;
          width: 100%;
          text-align: left;
          padding: 9px 10px;
          border: none;
          background: none;
          border-radius: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          color: var(--ink);
          text-decoration: none;
          cursor: pointer;
        }

        .userMenuItem:hover {
          background: var(--vellum-2);
        }

        .userMenuItemCurrent {
          color: var(--ink-soft);
          cursor: default;
        }

        .userMenuItemCurrent:hover {
          background: none;
        }

        .userMenuItemDanger {
          color: var(--orange);
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
