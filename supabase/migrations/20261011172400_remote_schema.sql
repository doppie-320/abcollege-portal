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

CREATE OR REPLACE FUNCTION public.delete_expired_rejects()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
  AS $function$
BEGIN
  -- Delete users/requests where reject_date is older than 7 days
  DELETE FROM auth.users
  WHERE id IN (
    SELECT user_id 
    FROM public.user_requests
    WHERE request_status = 'rejected'
      AND reject_date < NOW() - INTERVAL '7 days'
  );
END;
$function$;

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

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_expired_rejects"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."reject_user"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_user"(uuid) TO "service_role";

SELECT cron.schedule_in_database('auto-delete-rejected-7days', '0 0 * * *', ' SELECT delete_expired_rejects(); ', 'postgres', NULL, true);

