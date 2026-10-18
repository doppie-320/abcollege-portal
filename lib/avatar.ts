import { deleteAvatar, uploadAvatar } from "@/app/profile/actions";
import { settle, type ActionResult } from "@/lib/actionResult";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

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

/**
 * The picture shows the moment it's picked (or removed); the server's version takes over
 * once the save and the refresh land, and the old one comes back if the save fails.
 */
export function useAvatarEditor(avatarUrl: string) {
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [shownUrl, setShownUrl] = useOptimistic(avatarUrl);
  const previewRef = useRef("");

  // Free the last local preview once it's no longer needed.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  async function save(file: File) {
    setError("");
    let dataBlob: Blob;
    try {
      dataBlob = await compressToSquare(file);
    } catch (cause) {
      // compressToSquare only throws messages written for the user.
      setError(cause instanceof Error ? cause.message : "That photo could not be read.");
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = URL.createObjectURL(dataBlob);
    previewRef.current = preview;

    startSaving(async () => {
      setShownUrl(preview);
      const result = await settle(avatarStore.write(dataBlob));
      if (result.error) setError(result.error);
    });
  }

  function reset() {
    setError("");
    startSaving(async () => {
      setShownUrl("");
      const result = await settle(avatarStore.clear());
      if (result.error) setError(result.error);
    });
  }

  return { avatarUrl: shownUrl, isSaving, error, save, reset };
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