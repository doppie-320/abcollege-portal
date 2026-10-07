import { deleteAvatar, uploadAvatar } from "@/app/profile/actions";
import { settle, type ActionResult } from "@/lib/actionResult";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";

const OUTPUT_SIZE = 320;
const OUTPUT_QUALITY = 0.85;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const AVATAR_ACCEPT = ACCEPTED_TYPES.join(",");

async function write(dataBlob: Blob): Promise<ActionResult> {
  const fd = new FormData();
  fd.append("pfp", dataBlob, "avatar.jpg");
  return uploadAvatar(fd);
}

async function clear(): Promise<ActionResult> {
  return deleteAvatar();
}

export const avatarStore = { write, clear };

// Shown when the action itself can't be reached (offline, server crash), as
// opposed to the friendly errors the actions return.
const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

export function useAvatarEditor(avatarUrl: string) {
  // The picked photo (or no photo) shows right away; it resets to the server's
  // URL once the refreshed profile arrives, or back to the old one on failure.
  const [optimisticUrl, setOptimisticUrl] = useOptimistic(avatarUrl);
  const [isSaving, startTransition] = useTransition();
  const [error, setError] = useState("");
  const previewUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const save = useCallback(
    async (file: File) => {
      setError("");
      let dataBlob: Blob;
      try {
        dataBlob = await compressToSquare(file);
      } catch (cause) {
        // compressToSquare only throws messages written for the user.
        setError(cause instanceof Error ? cause.message : "That photo could not be read.");
        return;
      }

      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      const preview = URL.createObjectURL(dataBlob);
      previewUrl.current = preview;

      startTransition(async () => {
        setOptimisticUrl(preview);
        const result = await settle(avatarStore.write(dataBlob), NETWORK_ERROR);
        if (result.error) setError(result.error);
      });
    },
    [setOptimisticUrl]
  );

  const reset = useCallback(() => {
    setError("");
    startTransition(async () => {
      setOptimisticUrl("");
      const result = await settle(avatarStore.clear(), NETWORK_ERROR);
      if (result.error) setError(result.error);
    });
  }, [setOptimisticUrl]);

  return { avatarUrl: optimisticUrl, isSaving, error, save, reset };
}

async function compressToSquare(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Pick a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is over 10 MB. Pick a smaller one.");
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

  return blob;
}