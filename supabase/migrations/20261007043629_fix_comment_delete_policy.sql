-- The delete policy compared auth.uid() to the comment's own id instead of its
-- author, so it never matched and every delete silently removed 0 rows.
-- Also lets admins delete any comment (moderation), matching the UI.

DROP POLICY IF EXISTS "Authenticated can delete their own comments" ON "public"."announcement_comments";

CREATE POLICY "Authors and admins can delete comments" ON "public"."announcement_comments"
  FOR DELETE
  TO "authenticated"
  USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Same pass: the insert policy accepted any author_id, so a user could post a
-- comment under someone else's name. Require it to be the caller.

DROP POLICY IF EXISTS "Authenticated can write comments" ON "public"."announcement_comments";

CREATE POLICY "Authenticated can write their own comments" ON "public"."announcement_comments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (author_id = (SELECT auth.uid()));
