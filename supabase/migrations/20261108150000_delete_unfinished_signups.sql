-- Signing in with Google creates an auth user straight away, before the person
-- has filled in the sign-up form. If they back out ("No" on "Account not
-- found", "Cancel" on the details step, or just closing the tab) that auth user
-- stayed behind with no student record. Their email was then taken: email
-- sign-up said "Account already exists", while Google log in kept saying
-- "Account not found".
--
-- Unfinished means nothing ever came of the account: no student details, not
-- an admin or faculty member, and never accepted. Such an account can't use the
-- portal (getAccountStatus reports it as "no-account"), so deleting it loses
-- nothing and frees the email.
CREATE OR REPLACE FUNCTION public.is_unfinished_signup(uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM public.students WHERE id = uid)
     AND NOT EXISTS (SELECT 1 FROM public.admins WHERE id = uid)
     AND NOT EXISTS (SELECT 1 FROM public.faculty WHERE id = uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.user_requests
       WHERE user_id = uid AND request_status = 'accept'
     );
$function$;

REVOKE ALL ON FUNCTION public.is_unfinished_signup(uuid) FROM PUBLIC, anon, authenticated;

-- The signed-in user saying they don't want an account after all. Returns
-- whether anything was deleted; a finished account is left alone.
CREATE OR REPLACE FUNCTION public.delete_own_unfinished_signup()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  IF NOT public.is_unfinished_signup(uid) THEN
    RETURN false;
  END IF;

  -- public.users and everything hanging off it cascade from here.
  DELETE FROM auth.users WHERE id = uid;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_unfinished_signup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_unfinished_signup() TO authenticated;

-- Catches the ones nobody backed out of explicitly, e.g. a closed tab. Waits a
-- day after both sign-up and the last sign-in, so someone who is filling in the
-- form right now isn't deleted from under it.
CREATE OR REPLACE FUNCTION public.delete_abandoned_signups()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM auth.users u
  WHERE u.created_at < now() - interval '1 day'
    AND (u.last_sign_in_at IS NULL OR u.last_sign_in_at < now() - interval '1 day')
    AND public.is_unfinished_signup(u.id);

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$;

-- Only the scheduled job needs to call this.
REVOKE ALL ON FUNCTION public.delete_abandoned_signups() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'delete-abandoned-signups',
  '30 0 * * *',
  'SELECT public.delete_abandoned_signups();'
);
