SET local check_function_bodies = off;

ALTER TABLE "public"."user_requests"
  ALTER COLUMN "submitted_at" SET NOT NULL;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.admins where id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.on_user_register()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$DECLARE
  user_role text;
  f_name text;
  l_name text;
  email text;
BEGIN

  IF (NEW.raw_app_meta_data ->> 'provider') = 'google' THEN
    RAISE EXCEPTION 'Access denied: Self-registration via Google is not allowed. Your email must be added by an administrator first.';
  END IF;
  -- Extract name safely from either email signup or Google OAuth metadata
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
    NEW.raw_user_meta_data ->> 'email_address',
    NEW.raw_user_meta_data ->> 'email'
  );

  -- 1. Create base record in public.users
  INSERT INTO public.users (id, first_name, last_name)
  VALUES (NEW.id, f_name, l_name);

  user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', '');

  -- 2. Only insert into students if student_id is explicitly provided
  IF (user_role = 'student' OR (NEW.raw_user_meta_data ->> 'student_id') IS NOT NULL) 
     AND (NEW.raw_user_meta_data ->> 'student_id') <> '' THEN
    INSERT INTO public.students (
      id, 
      student_id, 
      year_level, 
      course
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'student_id',
      NULLIF(NEW.raw_user_meta_data ->> 'year_level', '')::bigint,
      NULLIF(NEW.raw_user_meta_data ->> 'course_id', '')::bigint
    );
  END IF;

  RETURN NEW;
END;$function$;

CREATE POLICY "allow admins to accept/reject" ON "public"."user_requests"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.admins
  WHERE (admins.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admins
  WHERE (admins.id = auth.uid()))));

