SET local check_function_bodies = off;

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

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_expired_rejects"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_expired_rejects"() TO "service_role";

SELECT cron.schedule_in_database('auto-delete-rejected-7days', '0 0 * * *', ' SELECT delete_expired_rejects(); ', 'postgres', NULL, true);

