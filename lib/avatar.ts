import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "soehub:avatar:";
const OUTPUT_SIZE = 320;
const OUTPUT_QUALITY = 0.85;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const AVATAR_ACCEPT = ACCEPTED_TYPES.join(",");

const cache = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function read(userId: string): string {
  const cached = cache.get(userId);
  if (cached !== undefined) return cached;

  let value = "";
  try {
    value = window.localStorage.getItem(storageKey(userId)) ?? "";
  } catch {
    value = "";
  }

  cache.set(userId, value);
  return value;
}

async function write(userId: string, dataUrl: string): Promise<void> {
  try {
    window.localStorage.setItem(storageKey(userId), dataUrl);
  } catch {
    throw new Error("Your browser storage is full, so the photo was not saved.");
  }

  cache.set(userId, dataUrl);
  listeners.get(userId)?.forEach((listener) => listener());
}

async function clear(userId: string): Promise<void> {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    /* storage unavailable; still drop the in-memory copy below */
  }

  cache.set(userId, "");
  listeners.get(userId)?.forEach((listener) => listener());
}

/* ---------------------------------------------------------------------------
 * BACKEND HANDOFF
 *
 * Everything above is deliberately local-only. To move avatars to Supabase:
 *
 * 1. Run `supabase/avatar.sql` once (adds `users.avatar_path`, the `avatars`
 *    bucket, and the RLS policies).
 * 2. Add an `uploadAvatar(formData)` server action to `app/profile/actions.ts`
 *    that verifies the caller with `supabase.auth.getUser()`, uploads the
 *    compressed blob to `storage.from("avatars").upload(`${userId}/${uuid}.jpg`,
 *    file)`, writes the returned path to `users.avatar_path`, and calls
 *    `refresh()` from `next/cache`.
 * 3. Replace the two bodies below with calls to that action. `read` becomes a
 *    read of the `avatarUrl` that `getProfile()` in `lib/auth.ts` already
 *    selects, and `useAvatarValue` should then take that prop instead of
 *    reading the store.
 * 4. Add the Supabase host to `images.remotePatterns` in `next.config.ts`,
 *    since the src becomes a remote URL rather than a data URL.
 * ------------------------------------------------------------------------- */
export const avatarStore = { read, write, clear };

function subscribe(userId: string, onChange: () => void) {
  const group = listeners.get(userId) ?? new Set<() => void>();
  group.add(onChange);
  listeners.set(userId, group);

  function onStorage(event: StorageEvent) {
    if (event.key !== storageKey(userId)) return;
    cache.delete(userId);
    onChange();
  }

  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
    group.delete(onChange);
    if (group.size === 0 && listeners.get(userId) === group) {
      listeners.delete(userId);
    }
  };
}

export function useAvatarValue(userId?: string): string {
  const subscribeToStore = useCallback(
    (onChange: () => void) => (userId ? subscribe(userId, onChange) : () => {}),
    [userId]
  );
  const getStoreSnapshot = useCallback(
    () => (userId ? read(userId) : ""),
    [userId]
  );

  return useSyncExternalStore(subscribeToStore, getStoreSnapshot, () => "");
}

export function useAvatarEditor(userId: string) {
  const avatarUrl = useAvatarValue(userId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(
    async (file: File) => {
      setError("");
      setIsSaving(true);
      try {
        const dataUrl = await compressToSquare(file);
        await avatarStore.write(userId, dataUrl);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "That photo could not be saved.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  const reset = useCallback(async () => {
    setError("");
    setIsSaving(true);
    try {
      await avatarStore.clear(userId);
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  return { avatarUrl, isSaving, error, save, reset };
}

async function compressToSquare(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Pick a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is over 5 MB. Pick a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file could not be read as an image.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not process that image.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", OUTPUT_QUALITY);
  });
  if (!blob) {
    throw new Error("Your browser could not process that image.");
  }

  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.readAsDataURL(blob);
  });
}
