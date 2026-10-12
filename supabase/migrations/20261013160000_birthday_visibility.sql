-- Lets admins hide a member's birthday from the calendar. A row here means
-- "hidden from regular users"; no row means the birthday is shown. This lives
-- in its own table rather than on public.users because members can update
-- their own users row, and this switch belongs to admins.
CREATE TABLE IF NOT EXISTS "public"."hidden_birthdays" (
  "user_id"   uuid                     NOT NULL,
  "hidden_by" uuid                              DEFAULT auth.uid(),
  "hidden_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hidden_birthdays_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "hidden_birthdays_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT "hidden_birthdays_hidden_by_fkey" FOREIGN KEY (hidden_by) REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE "public"."hidden_birthdays"
  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE "public"."hidden_birthdays" TO "authenticated";

DROP POLICY IF EXISTS "Admins can read hidden birthdays" ON "public"."hidden_birthdays";
CREATE POLICY "Admins can read hidden birthdays" ON "public"."hidden_birthdays"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can hide birthdays" ON "public"."hidden_birthdays";
CREATE POLICY "Admins can hide birthdays" ON "public"."hidden_birthdays"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can unhide birthdays" ON "public"."hidden_birthdays";
CREATE POLICY "Admins can unhide birthdays" ON "public"."hidden_birthdays"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

-- The return type gains is_hidden, which CREATE OR REPLACE can't change.
DROP FUNCTION IF EXISTS public.birthday_celebrants(integer);

-- Approved members (and admins) born in the given month. Regular users only
-- get the birthdays admins haven't hidden; admins get everyone, flagged, so
-- they can switch each one on or off. Only the day is returned, never the year.
CREATE FUNCTION public.birthday_celebrants (
  target_month integer
)
  RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    avatar_path text,
    birth_day integer,
    is_hidden boolean
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

REVOKE ALL ON FUNCTION public.birthday_celebrants(integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.birthday_celebrants(integer) TO "authenticated";
