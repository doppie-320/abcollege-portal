-- A birthday entered at sign-up is now always saved. When the user didn't tick
-- the consent box, it's saved hidden: a hidden_birthdays row keeps it off the
-- calendar for regular members, the same as an admin hiding it by hand.
--
-- The metadata key changes from consented_birthdate to signup_birthdate, with
-- consent in its own birthdate_consent flag. It's still not plain "birthdate":
-- OAuth providers can put their own birthdate claim in this metadata, which
-- nobody chose to share and which may not be a full date (OIDC allows a year of
-- 0000). Anything but an explicit true counts as no consent, so a birthday is
-- never shown by default.
CREATE OR REPLACE FUNCTION public.on_user_register()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$DECLARE
  user_id uuid;
  user_role text;
  f_name text;
  l_name text;
  email text;
  birth_date date;
BEGIN

  f_name := COALESCE(
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'given_name',
    split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 1),
    ''
  );

  l_name := COALESCE(
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'family_name',
    substr(NEW.raw_user_meta_data ->> 'full_name', length(split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 1)) + 2),
    ''
  );

  email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data ->> 'email'
  );

  birth_date := NULLIF(NEW.raw_user_meta_data ->> 'signup_birthdate', '')::date;

  user_id = NEW.id;

  -- 1. Create base record in public.users
  INSERT INTO public.users (id, first_name, last_name, email_address, birthdate)
  VALUES (
    user_id,
    f_name,
    l_name,
    email,
    birth_date
  );

  IF birth_date IS NOT NULL
     AND COALESCE(NEW.raw_user_meta_data ->> 'birthdate_consent', '') <> 'true' THEN
    -- Named by constraint: "(user_id)" would clash with the variable above.
    INSERT INTO public.hidden_birthdays (user_id, hidden_by)
    VALUES (NEW.id, NULL)
    ON CONFLICT ON CONSTRAINT hidden_birthdays_pkey DO NOTHING;
  END IF;

  INSERT INTO public.user_requests (user_id, request_status)
  VALUES (user_id, 'pending');

  user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', '');

  -- 2. Only insert into students if student_id is explicitly provided
  IF (user_role = 'student' OR (NEW.raw_user_meta_data ->> 'student_id') IS NOT NULL)
     AND (NEW.raw_user_meta_data ->> 'student_id') <> '' THEN
    INSERT INTO public.students (
      id,
      student_id,
      student_id_char,
      student_id_num,
      year_level,
      course
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'student_id',
      NEW.raw_user_meta_data ->> 'student_id_char',
      NULLIF(NEW.raw_user_meta_data ->> 'student_id_num', '')::bigint,
      NULLIF(NEW.raw_user_meta_data ->> 'year_level', '')::bigint,
      NULLIF(NEW.raw_user_meta_data ->> 'course_id', '')::bigint
    );
  END IF;

  RETURN NEW;
END;$function$;

-- Google sign-ups save the birthday after the trigger has run, as the signed-in
-- user, and only admins can write hidden_birthdays. This saves the birthday and,
-- without consent, hides it, in one transaction, so a birthday can't end up
-- saved but visible. It only ever hides: consenting doesn't undo a hide, since
-- that switch is the admins'.
CREATE OR REPLACE FUNCTION public.save_signup_birthdate(
  birthdate date,
  consent boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  UPDATE public.users
  SET birthdate = save_signup_birthdate.birthdate
  WHERE id = auth.uid();

  IF save_signup_birthdate.birthdate IS NOT NULL AND consent IS DISTINCT FROM true THEN
    INSERT INTO public.hidden_birthdays (user_id, hidden_by)
    VALUES (auth.uid(), NULL)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_signup_birthdate(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_signup_birthdate(date, boolean) TO authenticated;
