import { deleteAvatar, uploadAvatar } from "@/app/profile/actions";
import { settle, type ActionResult } from "@/lib/actionResult";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

const OUTPUT_SIZE = 320;
const OUTPUT_QUALITY = 0.85;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The whole photo is kept for the viewer, scaled down until it fits beside the crop in one
// server action request (capped at 1 MB by Next.js, multipart overhead included).
const FULL_ATTEMPTS = [
  { side: 1600, quality: 0.85 },
  { side: 1280, quality: 0.8 },
  { side: 1024, quality: 0.75 },
];
const FULL_BUDGET_BYTES = 850 * 1024;

export const AVATAR_ACCEPT = ACCEPTED_TYPES.join(",");

/** The square of the source photo, in its own pixels, that becomes the profile picture. */
export type AvatarCrop = { x: number; y: number; size: number };

type AvatarImages = { crop: Blob; full: Blob };
type AvatarUrls = { url: string; fullUrl: string };

async function write({ crop, full }: AvatarImages): Promise<ActionResult> {
  const fd = new FormData();
  fd.append("pfp", crop, "avatar.jpg");
  fd.append("pfp_full", full, "avatar-full.jpg");
  return uploadAvatar(fd);
}

async function clear(): Promise<ActionResult> {
  return deleteAvatar();
}

export const avatarStore = { write, clear };

/**
 * The picture shows the moment it's cropped (or removed); the server's version takes over
 * once the save and the refresh land, and the old one comes back if the save fails.
 */
export function useAvatarEditor(avatarUrl: string, avatarFullUrl: string) {
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [shown, setShown] = useOptimistic<AvatarUrls>({ url: avatarUrl, fullUrl: avatarFullUrl });
  const previewsRef = useRef<string[]>([]);

  function revokePreviews() {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current = [];
  }

  // Free the last local previews once they're no longer needed.
  useEffect(() => revokePreviews, []);

  /** Checks a picked file before it's cropped; false (with the reason shown) when it can't be used. */
  function accept(file: File): boolean {
    const problem = checkFile(file);
    setError(problem ?? "");
    return problem === null;
  }

  async function save(file: File, crop: AvatarCrop) {
    setError("");
    let images: AvatarImages;
    try {
      images = await renderAvatar(file, crop);
    } catch (cause) {
      // renderAvatar only throws messages written for the user.
      setError(cause instanceof Error ? cause.message : "That photo could not be read.");
      return;
    }

    revokePreviews();
    const preview = { url: URL.createObjectURL(images.crop), fullUrl: URL.createObjectURL(images.full) };
    previewsRef.current = [preview.url, preview.fullUrl];

    startSaving(async () => {
      setShown(preview);
      const result = await settle(avatarStore.write(images));
      if (result.error) setError(result.error);
    });
  }

  function reset() {
    setError("");
    startSaving(async () => {
      setShown({ url: "", fullUrl: "" });
      const result = await settle(avatarStore.clear());
      if (result.error) setError(result.error);
    });
  }

  return { avatarUrl: shown.url, avatarFullUrl: shown.fullUrl, isSaving, error, accept, save, reset };
}

function checkFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Pick a JPG, PNG, or WebP image.";
  if (file.size > MAX_FILE_BYTES) return "That image is over 10 MB. Pick a smaller one.";
  return null;
}

async function renderAvatar(file: File, crop: AvatarCrop): Promise<AvatarImages> {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file could not be read as an image.");
  }

  try {
    const cropped = await toJpeg(OUTPUT_SIZE, OUTPUT_SIZE, OUTPUT_QUALITY, (context) => {
      context.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    });

    let full: Blob | null = null;
    for (const { side, quality } of FULL_ATTEMPTS) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      full = await toJpeg(width, height, quality, (context) => {
        context.drawImage(bitmap, 0, 0, width, height);
      });
      if (full.size <= FULL_BUDGET_BYTES) break;
    }

    return { crop: cropped, full: full! };
  } finally {
    bitmap.close();
  }
}

async function toJpeg(
  width: number,
  height: number,
  quality: number,
  draw: (context: CanvasRenderingContext2D) => void,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process that image.");

  // JPEG has no transparency; without this, see-through parts of a PNG turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  draw(context);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) throw new Error("Your browser could not process that image.");

  return blob;
}
