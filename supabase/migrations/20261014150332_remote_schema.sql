SET local check_function_bodies = off;

ALTER TABLE "public"."students"
  ADD COLUMN "student_id_char" text;

ALTER TABLE "public"."students"
  ADD COLUMN "student_id_num" bigint;

CREATE OR REPLACE FUNCTION public.birthday_celebrants (
  target_month integer
)
  RETURNS TABLE (
    id          uuid,
    first_name  text,
    last_name   text,
    avatar_path text,
    birth_day   integer,
    is_hidden   boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    u.id,
    u.first_name,
    u.last_name,
    u.avatar_path,
    extract(day from u.birthdate)::integer as birth_day,
    (h.user_id is not null) as is_hidden
  from public.users u
  left join public.hidden_birthdays h on h.user_id = u.id
  where u.birthdate is not null
    and extract(month from u.birthdate) = target_month
    and (
      exists (
        select 1 from public.user_requests r
        where r.user_id = u.id and r.request_status = 'accept'
      )
      or exists (select 1 from public.admins a where a.id = u.id)
    )
    and (h.user_id is null or public.is_admin())
  order by birth_day, u.first_name, u.last_name;
$function$;

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

