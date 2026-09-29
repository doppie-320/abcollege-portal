"use client";

import Image from "next/image";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { AVATAR_ACCEPT, useAvatarEditor } from "@/lib/avatar";

type AvatarActions = {
  /** Opens the hidden file picker. */
  onEdit: () => void;
  /** True while the picked image is being validated, cropped and stored. */
  isSaving: boolean;
  /** True when a photo is currently stored for this user. */
  hasAvatar: boolean;
  /** Clears the stored photo. */
  onRemove: () => void;
};

const AvatarActionsContext = createContext<AvatarActions | null>(null);

const EDIT_BUTTON_CLASS = "btn ghost px-2 py-1 text-[10px]"

/**
 * Drop this inside <AvatarEditor> to place the edit trigger wherever the
 * layout needs it (e.g. beside the photo, under the name and program).
 */
export function AvatarEditButton() {
  const actions = useContext(AvatarActionsContext);
  if (!actions) {
    throw new Error("AvatarEditButton must be rendered inside <AvatarEditor>.");
  }
  const { onEdit, isSaving } = actions;

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={isSaving}
      className={EDIT_BUTTON_CLASS}
    >
      <CameraIcon size={13} />
      Edit profile picture
    </button>
  );
}

/** Clears the stored photo. Also requires an <AvatarEditor> ancestor. */
export function AvatarRemoveButton() {
  const actions = useContext(AvatarActionsContext);
  if (!actions) {
    throw new Error("AvatarRemoveButton must be rendered inside <AvatarEditor>.");
  }
  const { onRemove, hasAvatar, isSaving } = actions;
  if (!hasAvatar) return null;

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={isSaving}
      className="btn ghost px-2 py-1 text-[10px]"
    >
      Remove photo
    </button>
  );
}

type AvatarEditorProps = {
  userId: string;
  initials: string;
  name: string;
  /** Rendered beside the picture, so callers control the side column layout. */
  children?: ReactNode;
};

export default function AvatarEditor({
  userId,
  initials,
  name,
  children,
}: AvatarEditorProps) {
  const { avatarUrl, isSaving, error, save, reset } = useAvatarEditor(userId);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<AvatarActions>(
    () => ({
      onEdit: () => inputRef.current?.click(),
      isSaving,
      hasAvatar: Boolean(avatarUrl),
      onRemove: () => void reset(),
    }),
    [isSaving, avatarUrl, reset],
  );

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void save(file);
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <span className="eyebrow">STUDENT CARD</span>

      <div className="flex w-full items-start gap-6">
        <div className="flex w-32 shrink-0 flex-col items-center gap-2.5">
          {/* Profile Picture */}
          <div className="relative size-32 shrink-0 overflow-hidden rounded-full border border-navy-tint bg-blue">
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

        <AvatarActionsContext.Provider value={actions}>
          {children}
        </AvatarActionsContext.Provider>
      </div>
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
