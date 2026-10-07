ALTER TABLE "public"."comments"
  DROP CONSTRAINT "comments_author_id_fkey";

ALTER TABLE "public"."comments"
  DROP CONSTRAINT "comments_parent_fkey";

DROP TABLE "public"."comments";

CREATE TABLE "public"."announcement_comments" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" uuid                     NOT NULL,
  "author_id"       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "content"         text                     NOT NULL DEFAULT ''::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "announcement_comments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."announcement_comments"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."announcement_comments"
  ADD CONSTRAINT "announcement_comments_announcement_id_fkey" FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."announcement_comments"
  ADD CONSTRAINT "announcement_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE POLICY "Authenticated can delete their own comments" ON "public"."announcement_comments"
  FOR DELETE
  TO "authenticated"
  USING ((auth.uid() = id));

CREATE POLICY "Authenticated can edit their own comments" ON "public"."announcement_comments"
  FOR UPDATE
  TO "authenticated"
  USING ((author_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((author_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Authenticated can read all comments" ON "public"."announcement_comments"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Authenticated can write comments" ON "public"."announcement_comments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."announcement_comments" FROM "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."announcement_comments" TO "anon";

REVOKE ALL ON TABLE "public"."announcement_comments" FROM "authenticated";

REVOKE ALL ("content") ON TABLE "public"."announcement_comments" FROM "authenticated";

GRANT UPDATE ("content") ON TABLE "public"."announcement_comments" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."announcement_comments" TO "authenticated";

REVOKE ALL ON TABLE "public"."announcement_comments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."announcement_comments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."announcement_comments" TO "service_role";

