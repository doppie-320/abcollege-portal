-- Admins need access to private student details used by the account review page.
-- This policy is intentionally separate from the public users policy.

DROP POLICY IF EXISTS "Admins can read student details" ON "public"."students";

CREATE POLICY "Admins can read student details"
ON "public"."students"
FOR SELECT
TO "authenticated"
USING ((SELECT public.is_admin()));
