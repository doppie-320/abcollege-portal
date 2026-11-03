"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ImageLightbox from "@/app/home/ImageLightbox";
import { AVATAR_ACCEPT, useAvatarEditor, type AvatarCrop } from "@/lib/avatar";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";
import AvatarCropper from "./AvatarCropper";

const MENU_WIDTH = 192;

type AvatarEditorProps = {
  userId: string;
  initials: string;
  name: string;
  /** Rendered beside the picture, so callers control the side column layout. */
  children?: ReactNode;
  /** Card caption above the picture. Defaults to the student-facing wording; null hides it. */
  eyebrow?: string | null;
  avatarUrl: string;
  /** The whole photo the avatar was cropped from, shown by "View profile picture". */
  avatarFullUrl: string;
};

export default function AvatarEditor({
  initials,
  name,
  children,
  eyebrow = "STUDENT CARD",
  avatarUrl: savedUrl,
  avatarFullUrl: savedFullUrl
}: AvatarEditorProps) {
  // Shows a cropped photo (or its removal) at once, before the upload finishes.
  const { avatarUrl, avatarFullUrl, isSaving, error, accept, save, reset } = useAvatarEditor(
    savedUrl,
    savedFullUrl
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The menu goes in document.body, kept on screen: beside the picture it ran off narrow phones.
  const {
    triggerRef,
    place: menuPlace,
    open: menuOpen,
    show: showMenu,
    hide: hideMenu,
  } = useAnchoredPopover<HTMLButtonElement>({ width: MENU_WIDTH, minHeight: 130 });
  const [viewerOpen, setViewerOpen] = useState(false);
  // The picked photo, while the user chooses which part of it shows.
  const [cropping, setCropping] = useState<{ file: File; src: string } | null>(null);
  const hasAvatar = Boolean(avatarUrl);

  function openPicker() {
    hideMenu();
    inputRef.current?.click();
  }

  function handleRemove() {
    hideMenu();
    reset();
  }

  function handleView() {
    if (!hasAvatar) return;
    hideMenu();
    setViewerOpen(true);
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && accept(file)) setCropping({ file, src: URL.createObjectURL(file) });
  }

  function onCropped(crop: AvatarCrop) {
    if (!cropping) return;
    setCropping(null);
    void save(cropping.file, crop);
  }

  // Free the picked photo's preview once the cropper closes.
  useEffect(() => {
    if (!cropping) return;
    return () => URL.revokeObjectURL(cropping.src);
  }, [cropping]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) hideMenu();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") hideMenu();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, hideMenu, triggerRef]);

  return (
    <div className="flex w-full flex-col gap-2.5">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}

      {/* Stacks on phones: side by side, the name column is too narrow and leaves a gap under the picture. */}
      <div className="flex w-full items-start gap-6 max-[480px]:flex-col max-[480px]:items-stretch max-[480px]:gap-3">
        <div className="flex w-32 shrink-0 flex-col items-center gap-2.5">
          <div className="relative size-32 shrink-0">
            {/* Paper ring keeps the edge visible when the picture overlaps a navy banner. */}
            <div className="size-full rounded-full border-2 border-navy shadow-md ring-4 ring-paper">
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
            <div className="absolute right-0 bottom-0">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (menuOpen ? hideMenu() : showMenu())}
                disabled={isSaving}
                title="Profile picture options"
                aria-label="Profile picture options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex size-9 items-center justify-center rounded-full border-2 border-paper bg-navy text-paper shadow-md transition hover:bg-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-60"
              >
                <CameraIcon size={16} />
              </button>

              {menuPlace && createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Profile picture options"
                  style={{
                    left: menuPlace.left,
                    top: menuPlace.top,
                    width: menuPlace.width,
                    transform: menuPlace.above ? "translateY(-100%)" : undefined,
                  }}
                  className="fixed z-[150] overflow-hidden rounded-[6px] border border-rule bg-paper shadow-[0_10px_24px_rgba(13,30,56,0.16)]"
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
                </div>,
                document.body
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

      {cropping && (
        <AvatarCropper src={cropping.src} onCancel={() => setCropping(null)} onConfirm={onCropped} />
      )}

      {/* The whole photo, not just the cropped circle. */}
      {viewerOpen && hasAvatar && (
        <ImageLightbox
          items={[{ src: avatarFullUrl || avatarUrl, alt: `${name}'s profile picture` }]}
          index={0}
          onClose={() => setViewerOpen(false)}
          onIndexChange={() => {}}
        />
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
