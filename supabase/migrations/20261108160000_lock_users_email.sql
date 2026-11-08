-- public.users.email_address is a copy of the account's auth email. Decision
-- emails go to it, and it's unique. Members could edit it, though (the
-- table-wide UPDATE grant plus the "users update their own row" policy), so
-- anyone signed in could set it to someone else's address. That person's
-- sign-up then failed in on_user_register's insert, by email or with Google,
-- with an error that didn't say why, and decision emails went wherever the
-- column pointed.
--
-- Members now only update the columns the app edits (names at Google sign-up,
-- the avatar on the profile page). The email follows auth.users instead.
REVOKE UPDATE ON TABLE public.users FROM PUBLIC, anon, authenticated;
GRANT UPDATE (first_name, last_name, avatar_path) ON TABLE public.users TO authenticated;

-- Supabase changes auth.users.email when someone confirms an email change.
CREATE OR REPLACE FUNCTION public.sync_user_email()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND COALESCE(NEW.email, '') <> '' THEN
    UPDATE public.users SET email_address = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();

-- Put back any address that was already changed, unless another row holds it
-- (that would break the unique key; it's left for an admin to sort out).
UPDATE public.users pu
SET email_address = au.email
FROM auth.users au
WHERE au.id = pu.id
  AND COALESCE(au.email, '') <> ''
  AND pu.email_address IS DISTINCT FROM au.email
  AND NOT EXISTS (
    SELECT 1 FROM public.users other
    WHERE other.email_address = au.email AND other.id <> pu.id
  );
