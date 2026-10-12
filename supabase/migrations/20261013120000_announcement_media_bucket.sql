-- Public bucket for images, videos and files embedded in announcements
-- (see lib/uploadMedia.ts). Size limit matches MAX_UPLOAD_BYTES (50 MB).
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit")
VALUES ('announcement-media', 'announcement-media', true, 52428800)
ON CONFLICT ("id") DO UPDATE
  SET "public" = EXCLUDED."public",
      "file_size_limit" = EXCLUDED."file_size_limit";

-- Reads go through public URLs, so no SELECT policy is needed.

DROP POLICY IF EXISTS "admins upload announcement media" ON "storage"."objects";

CREATE POLICY "admins upload announcement media" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'announcement-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ( SELECT public.is_admin() AS is_admin)));

DROP POLICY IF EXISTS "admins delete their own announcement media" ON "storage"."objects";

CREATE POLICY "admins delete their own announcement media" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'announcement-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ( SELECT public.is_admin() AS is_admin)));
