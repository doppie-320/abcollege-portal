-- Let any signed-in user read other users' public profile (name + avatar), so
-- announcement authors, commenters and reactors show up instead of "Unknown".
--
-- Safe to open the whole row: "users" only holds first_name, last_name,
-- avatar_path and created_at. Private details (student_id, year level, course)
-- live in "students", whose policies are unchanged.
--
-- Replaces the own-row-only policy; an own-row check is redundant once every
-- authenticated user can read every row.

DROP POLICY IF EXISTS "Users can read their own profile" ON "public"."users";

CREATE POLICY "Authenticated users can read profiles" ON "public"."users"
  FOR SELECT
  TO "authenticated"
  USING (true);
