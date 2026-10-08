import type { SupabaseClient } from "@supabase/supabase-js";

// Public Supabase Storage bucket for files embedded in announcements.
// Must exist (set up by the backend) with an insert policy for authenticated
// users; uploads go to <user id>/<uuid>-<file name>.
export const MEDIA_BUCKET = "announcement-media";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type UploadedMedia = {
  url: string;
  downloadUrl: string;
  name: string;
  size: number;
  mime: string;
};

export async function uploadMedia(supabase: SupabaseClient, userId: string, file: File): Promise<UploadedMedia> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`"${file.name}" is larger than ${formatFileSize(MAX_UPLOAD_BYTES)}.`);
  }

  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-100) || "file";
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, cacheControl: "31536000" });

  if (error) throw error;

  const bucket = supabase.storage.from(MEDIA_BUCKET);
  return {
    url: bucket.getPublicUrl(path).data.publicUrl,
    downloadUrl: bucket.getPublicUrl(path, { download: file.name }).data.publicUrl,
    name: file.name,
    size: file.size,
    mime: file.type,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
