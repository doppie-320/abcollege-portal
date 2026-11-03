-- Admins could only see their own admins row, so the account review page had
-- no way to tell which applicants are admins and listed them for accepting or
-- rejecting. Let admins read the whole table; everyone else still sees only
-- their own row. is_admin() is SECURITY DEFINER, so it doesn't recurse into
-- this policy.
CREATE POLICY "Admins can see all admins" ON "public"."admins"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));
