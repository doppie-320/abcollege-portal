-- Calendar page (app/calendar): events everyone signed in can read and admins
-- manage, plus the lookup behind "Birthday celebrants of the month".

-- All-day entries (holidays, foundation day, ...) have no meaningful times.
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "all_day" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events"
  DROP CONSTRAINT IF EXISTS "events_end_after_start";

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_end_after_start" CHECK (event_end >= event_start);

-- The page asks for every event overlapping the visible weeks.
CREATE INDEX IF NOT EXISTS "events_event_start_idx" ON "public"."events" (event_start);

-- RLS was enabled with no policies, so nobody could read the table.
DROP POLICY IF EXISTS "Authenticated can read events" ON "public"."events";
CREATE POLICY "Authenticated can read events" ON "public"."events"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "Admins can create events" ON "public"."events";
CREATE POLICY "Admins can create events" ON "public"."events"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can update events" ON "public"."events";
CREATE POLICY "Admins can update events" ON "public"."events"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can delete events" ON "public"."events";
CREATE POLICY "Admins can delete events" ON "public"."events"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_admin() AS is_admin));

-- Approved members (and admins) born in the given month. Only the day is
-- returned, never the year. SECURITY DEFINER because the admins table only
-- lets each admin see their own row.
CREATE OR REPLACE FUNCTION public.birthday_celebrants (
  target_month integer
)
  RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    avatar_path text,
    birth_day integer
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
    extract(day from u.birthdate)::integer as birth_day
  from public.users u
  where u.birthdate is not null
    and extract(month from u.birthdate) = target_month
    and (
      exists (
        select 1 from public.user_requests r
        where r.user_id = u.id and r.request_status = 'accept'
      )
      or exists (select 1 from public.admins a where a.id = u.id)
    )
  order by birth_day, u.first_name, u.last_name;
$function$;

REVOKE ALL ON FUNCTION public.birthday_celebrants(integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.birthday_celebrants(integer) TO "authenticated";
