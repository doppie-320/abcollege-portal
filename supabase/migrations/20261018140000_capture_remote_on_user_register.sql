-- on_user_register as it runs on the hosted project. It was changed there in
-- the dashboard (adding student_id_char and student_id_num, with the NULLIF
-- cast that fixes student signups) without a migration, so a fresh
-- `db reset` built the older version. Copied from `supabase db diff --linked`.
-- Pushing it changes nothing on the hosted project; it already has this.
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

  user_id = NEW.id;

  -- 1. Create base record in public.users
  INSERT INTO public.users (id, first_name, last_name, email_address)
  VALUES (user_id, f_name, l_name, email);

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
