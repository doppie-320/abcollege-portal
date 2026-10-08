"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AVATAR_ACCEPT, useAvatarEditor } from "@/lib/avatar";

type AvatarEditorProps = {
  userId: string;
  initials: string;
  name: string;
  /** Rendered beside the picture, so callers control the side column layout. */
  children?: ReactNode;
  avatarUrl: string;
};

export default function AvatarEditor({
  userId,
  initials,
  name,
  children,
  avatarUrl,
}: AvatarEditorProps) {
  const { isSaving, error, save, reset } = useAvatarEditor(avatarUrl, userId);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const hasAvatar = Boolean(avatarUrl);

  function openPicker() {
    setMenuOpen(false);
    inputRef.current?.click();
  }

  function handleRemove() {
    setMenuOpen(false);
    void reset();
  }

  function handleView() {
    if (!hasAvatar) return;
    setMenuOpen(false);
    setViewerOpen(true);
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void save(file);
  }

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Lock scroll + close viewer on Escape.
  useEffect(() => {
    if (!viewerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  return (
    <div className="flex w-full flex-col gap-2.5">
      <span className="eyebrow">STUDENT CARD</span>

      <div className="flex w-full items-start gap-6">
        <div className="flex w-32 shrink-0 flex-col items-center gap-2.5">
          <div className="relative size-32 shrink-0">
            <div className="size-full rounded-full border-2 border-navy shadow-md">
              <div className="relative size-full overflow-hidden rounded-full border border-navy-tint bg-blue">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${name}'s profile picture`}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center font-display text-[40px] font-semibold text-paper"
                  >
                    {initials}
                  </span>
                )}
              </div>
            </div>

            {/* Camera icon overlaid on the avatar border */}
            <div ref={menuRef} className="absolute right-0 bottom-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={isSaving}
                title="Profile picture options"
                aria-label="Profile picture options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex size-9 items-center justify-center rounded-full border-2 border-paper bg-navy text-paper shadow-md transition hover:bg-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-60"
              >
                <CameraIcon size={16} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Profile picture options"
                  className="absolute top-0 left-11 z-30 w-48 overflow-hidden rounded-[6px] border border-rule bg-paper shadow-[0_10px_24px_rgba(13,30,56,0.16)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openPicker}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-vellum"
                  >
                    <CameraIcon size={14} />
                    Change photo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleView}
                    disabled={!hasAvatar}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-vellum disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <EyeIcon size={14} />
                    View profile picture
                  </button>
                  {hasAvatar && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleRemove}
                      disabled={isSaving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-orange transition hover:bg-vellum disabled:cursor-wait disabled:opacity-60"
                    >
                      <TrashIcon size={14} />
                      Remove photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Saving Message */}
          {isSaving ? (
            <span
              aria-live="polite"
              className="text-center text-[11px] text-ink-soft"
            >
              Saving…
            </span>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="text-center text-[11px] leading-snug text-orange"
            >
              {error}
            </p>
          ) : null}

          {/* Hidden File Input */}
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={onPick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {children}
      </div>

      {/* Full-size profile picture viewer */}
      {viewerOpen && hasAvatar && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setViewerOpen(false)}
        >
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            aria-label="Close profile picture viewer"
            className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon />
          </button>
          <div
            className="rounded-full border-4 border-paper bg-paper p-1.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative size-72 overflow-hidden rounded-full max-[480px]:size-56">
              <Image
                src={avatarUrl}
                alt={`${name}'s profile picture`}
                fill
                sizes="288px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.7l1.2-2h7.2l1.2 2h2.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.6" r="3.3" />
    </svg>
  );
}

function EyeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
