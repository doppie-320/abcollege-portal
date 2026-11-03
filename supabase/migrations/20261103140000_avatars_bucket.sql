-- Public bucket for profile pictures (see app/profile/actions.ts). It was made
-- in the dashboard, so only its policies were captured; this creates it on a
-- fresh project. Size limit matches MAX_AVATAR_BYTES (10 MB).
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit")
VALUES ('avatars', 'avatars', true, 10485760)
ON CONFLICT ("id") DO UPDATE
  SET "public" = EXCLUDED."public",
      "file_size_limit" = EXCLUDED."file_size_limit";
