SET local check_function_bodies = off;

CREATE TABLE "public"."hidden_birthdays" (
  "user_id"   uuid                     NOT NULL,
  "hidden_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hidden_birthdays_pkey" PRIMARY KEY (user_id),
  "hidden_by" uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."hidden_birthdays"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."events"
  ADD COLUMN "all_day" boolean NOT NULL DEFAULT false;

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

REVOKE ALL ON FUNCTION "public"."birthday_celebrants"(integer) FROM PUBLIC, "anon";

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

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_end_after_start" CHECK ((event_end >= event_start));

ALTER TABLE "public"."hidden_birthdays"
  ADD CONSTRAINT "hidden_birthdays_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX events_event_start_idx ON public.events USING btree (event_start);

CREATE POLICY "Admins can create events" ON "public"."events"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Admins can delete events" ON "public"."events"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Admins can update events" ON "public"."events"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Authenticated can read events" ON "public"."events"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Admins can hide birthdays" ON "public"."hidden_birthdays"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Admins can read hidden birthdays" ON "public"."hidden_birthdays"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Admins can unhide birthdays" ON "public"."hidden_birthdays"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

GRANT EXECUTE ON FUNCTION "public"."birthday_celebrants"(integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."birthday_celebrants"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_celebrants"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."birthday_celebrants"(integer) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hidden_birthdays" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."hidden_birthdays" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hidden_birthdays" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hidden_birthdays" TO "service_role";

ALTER TABLE "public"."hidden_birthdays"
  ADD CONSTRAINT "hidden_birthdays_hidden_by_fkey" FOREIGN KEY (hidden_by) REFERENCES public.users(id) ON DELETE SET NULL;

