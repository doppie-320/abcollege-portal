SET local check_function_bodies = off;

ALTER TABLE "public"."students"
  DROP COLUMN "birthdate";

CREATE EXTENSION "pg_cron";

ALTER TABLE "public"."users"
  ADD COLUMN "birthdate" date;

ALTER TABLE "public"."user_requests"
  ALTER COLUMN "submitted_at" DROP NOT NULL;

ALTER TABLE "public"."users"
  ALTER COLUMN "email_address" SET NOT NULL;

CREATE OR REPLACE FUNCTION public.reject_user (
  target_user uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
  AS $function$
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be an admin to delete users.';
  END IF;

  -- Delete target user from auth.users
  DELETE FROM auth.users WHERE id = target_user;
END;
$function$;

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."reject_user"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO "service_role";

