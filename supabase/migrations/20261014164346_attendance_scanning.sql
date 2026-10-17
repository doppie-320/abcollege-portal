-- QR attendance (reimplements legacy/): admins flag events as taking attendance
-- and assign scanners. Students show a QR from get_my_attendance_token() that
-- rotates every 30 seconds and is signed with a per-student secret, so it can't
-- be forged or reused from a screenshot. Scanners look it up with
-- scan_student(), compare the photo, then accept or reject with record_scan().
-- Clients never write attendance rows directly.
--
-- Errors are raised with a stable code as the message (ATTENDANCE_*) and a
-- readable hint for the UI.

-- Secrets and internal helpers live outside "public" so the API never exposes
-- them; only the SECURITY DEFINER functions below can reach them.
CREATE SCHEMA IF NOT EXISTS "private";
REVOKE ALL ON SCHEMA "private" FROM PUBLIC, "anon", "authenticated";

-- Events --------------------------------------------------------------------

-- Check-in defaults to 30 minutes before event_start until event_end.
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "takes_attendance" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "check_in_opens_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "check_in_closes_at" timestamp with time zone;

ALTER TABLE "public"."events"
  DROP CONSTRAINT IF EXISTS "events_check_in_window";

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_check_in_window" CHECK (check_in_closes_at > check_in_opens_at);

-- Attendance ----------------------------------------------------------------

-- The old table keyed users by bigint, so no real user could ever be stored in
-- it. Refuse to drop it if that somehow isn't true.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.attendance) THEN
    RAISE EXCEPTION 'public.attendance has rows; export or clear them before rebuilding it';
  END IF;
END $$;

DROP TABLE "public"."attendance";

CREATE TYPE "public"."attendance_status" AS ENUM (
  'present',
  'rejected'
);

CREATE TYPE "public"."attendance_method" AS ENUM (
  'scan',
  'manual'
);

-- One row per student per event. A rejected scan can later be replaced by an
-- accepted one, but a present row is never downgraded by a scan.
CREATE TABLE "public"."attendance" (
  "event_id"    bigint                       NOT NULL,
  "user_id"     uuid                         NOT NULL,
  "status"      public.attendance_status     NOT NULL,
  "method"      public.attendance_method     NOT NULL,
  "recorded_by" uuid,
  "recorded_at" timestamp with time zone     NOT NULL DEFAULT now(),
  "note"        text,
  CONSTRAINT "attendance_pkey" PRIMARY KEY (event_id, user_id),
  -- Deleting an event that has attendance must be deliberate.
  CONSTRAINT "attendance_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT "attendance_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX "attendance_user_id_idx" ON "public"."attendance" (user_id);

ALTER TABLE "public"."attendance"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."event_scanners" (
  "event_id"    bigint                   NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "assigned_by" uuid                              DEFAULT auth.uid(),
  "assigned_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "event_scanners_pkey" PRIMARY KEY (event_id, user_id),
  CONSTRAINT "event_scanners_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE CASCADE,
  CONSTRAINT "event_scanners_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT "event_scanners_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX "event_scanners_user_id_idx" ON "public"."event_scanners" (user_id);

ALTER TABLE "public"."event_scanners"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."attendance_secrets" (
  "user_id"    uuid                     NOT NULL,
  "secret"     bytea                    NOT NULL DEFAULT extensions.gen_random_bytes(32),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_secrets_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "attendance_secrets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Policies ------------------------------------------------------------------

CREATE POLICY "Own, scanned or admin attendance is readable" ON "public"."attendance"
  FOR SELECT
  TO "authenticated"
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.event_scanners es
      WHERE es.event_id = attendance.event_id AND es.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can delete attendance" ON "public"."attendance"
  FOR DELETE
  TO "authenticated"
  USING ((SELECT public.is_admin()));

CREATE POLICY "Scanners see their assignments, admins see all" ON "public"."event_scanners"
  FOR SELECT
  TO "authenticated"
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Admins can assign scanners" ON "public"."event_scanners"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can unassign scanners" ON "public"."event_scanners"
  FOR DELETE
  TO "authenticated"
  USING ((SELECT public.is_admin()));

REVOKE ALL ON TABLE "public"."attendance" FROM "anon", "authenticated";
GRANT SELECT, DELETE ON TABLE "public"."attendance" TO "authenticated";

REVOKE ALL ON TABLE "public"."event_scanners" FROM "anon", "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."event_scanners" TO "authenticated";

-- Internal helpers ------------------------------------------------------------

-- QR tokens rotate every 30 seconds; this is the current 30-second slot.
CREATE OR REPLACE FUNCTION private.attendance_token_window()
  RETURNS bigint
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select floor(extract(epoch from now()) / 30)::bigint;
$function$;

-- Token format: v1.<user id>.<window>.<first 16 bytes of HMAC-SHA256, base64url>
CREATE OR REPLACE FUNCTION private.sign_attendance_token (
  p_user_id uuid,
  p_window bigint
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select 'v1.' || p_user_id || '.' || p_window || '.' || rtrim(translate(encode(
    substring(extensions.hmac(convert_to(p_user_id || '.' || p_window, 'UTF8'), s.secret, 'sha256') from 1 for 16),
    'base64'), '+/', '-_'), '=')
  from private.attendance_secrets s
  where s.user_id = p_user_id;
$function$;

-- Returns the student a token belongs to. p_max_age is how many 30-second
-- windows old the token may be (0 = current window only).
CREATE OR REPLACE FUNCTION private.verify_attendance_token (
  p_token text,
  p_max_age integer
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  parts text[] := string_to_array(p_token, '.');
  token_user uuid;
  token_window bigint;
  current_window bigint := private.attendance_token_window();
begin
  if coalesce(array_length(parts, 1), 0) <> 4
     or parts[1] <> 'v1'
     or parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[3] !~ '^[0-9]{1,18}$' then
    raise exception 'ATTENDANCE_TOKEN_INVALID' using hint = 'This is not a valid attendance QR code.';
  end if;

  token_user := parts[2]::uuid;
  token_window := parts[3]::bigint;

  if private.sign_attendance_token(token_user, token_window) is distinct from p_token
     or token_window > current_window then
    raise exception 'ATTENDANCE_TOKEN_INVALID' using hint = 'This is not a valid attendance QR code.';
  end if;

  if current_window - token_window > p_max_age then
    raise exception 'ATTENDANCE_TOKEN_EXPIRED' using hint = 'This QR code has expired. Ask the student to show the current one.';
  end if;

  return token_user;
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_approved_student (
  p_user_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.students s where s.id = p_user_id)
    and exists (
      select 1 from public.user_requests r
      where r.user_id = p_user_id and r.request_status = 'accept'
    );
$function$;

-- Raises unless the caller may scan for this event and check-in is open.
CREATE OR REPLACE FUNCTION private.assert_can_scan (
  p_event_id bigint
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  e public.events;
begin
  select * into e from public.events where event_id = p_event_id;

  if not found or not e.takes_attendance then
    raise exception 'ATTENDANCE_EVENT_NOT_TRACKED' using hint = 'This event does not take attendance.';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.event_scanners es
      where es.event_id = p_event_id and es.user_id = auth.uid()
    )
  ) then
    raise exception 'ATTENDANCE_NOT_SCANNER' using hint = 'You are not assigned to scan for this event.';
  end if;

  if now() < coalesce(e.check_in_opens_at, e.event_start - interval '30 minutes') then
    raise exception 'ATTENDANCE_NOT_OPEN' using hint = 'Check-in for this event has not opened yet.';
  end if;

  if now() > coalesce(e.check_in_closes_at, e.event_end) then
    raise exception 'ATTENDANCE_CLOSED' using hint = 'Check-in for this event has closed.';
  end if;
end;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "private" FROM PUBLIC, "anon", "authenticated";

-- API -----------------------------------------------------------------------

-- Student: the QR payload to display. Refresh it at expires_at; scanners
-- still accept it for a short while after, to cover the time spent scanning.
CREATE OR REPLACE FUNCTION public.get_my_attendance_token()
  RETURNS TABLE (
    token      text,
    expires_at timestamp with time zone
  )
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  current_window bigint := private.attendance_token_window();
begin
  if not private.is_approved_student(auth.uid()) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'Only approved students have an attendance QR code.';
  end if;

  insert into private.attendance_secrets (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return query
  select private.sign_attendance_token(auth.uid(), current_window),
         to_timestamp((current_window + 1) * 30);
end;
$function$;

-- Scanner: who a scanned QR belongs to, for the officer to compare against the
-- person in front of them. Records nothing.
CREATE OR REPLACE FUNCTION public.scan_student (
  p_event_id bigint,
  p_token text
)
  RETURNS TABLE (
    user_id     uuid,
    first_name  text,
    last_name   text,
    avatar_path text,
    student_id  text,
    course      text,
    year_level  text,
    status      public.attendance_status,
    recorded_at timestamp with time zone
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  student uuid;
begin
  perform private.assert_can_scan(p_event_id);
  student := private.verify_attendance_token(p_token, 1);

  if not private.is_approved_student(student) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  return query
  select u.id, u.first_name, u.last_name, u.avatar_path, s.student_id, c.name, y.name, a.status, a.recorded_at
  from public.users u
  join public.students s on s.id = u.id
  left join public.courses c on c.id = s.course
  left join public.yearlevels y on y.id = s.year_level
  left join public.attendance a on a.event_id = p_event_id and a.user_id = u.id
  where u.id = student;
end;
$function$;

-- Scanner: accept or reject the scanned student. Takes the token again rather
-- than a user id so scanners can't mark students who never showed a QR; it
-- stays valid for about two minutes to give the officer time to decide.
CREATE OR REPLACE FUNCTION public.record_scan (
  p_event_id bigint,
  p_token text,
  p_decision public.attendance_status
)
  RETURNS public.attendance
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  student uuid;
  result public.attendance;
begin
  perform private.assert_can_scan(p_event_id);
  student := private.verify_attendance_token(p_token, 3);

  if not private.is_approved_student(student) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  insert into public.attendance as a (event_id, user_id, status, method, recorded_by, recorded_at)
  values (p_event_id, student, p_decision, 'scan', auth.uid(), now())
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        method = excluded.method,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at,
        note = null
    where a.status <> 'present'
  returning * into result;

  -- Already present: keep the original record.
  if not found then
    select * into result from public.attendance a
    where a.event_id = p_event_id and a.user_id = student;
  end if;

  return result;
end;
$function$;

-- Admin: correct a record by hand, at any time.
CREATE OR REPLACE FUNCTION public.set_attendance (
  p_event_id bigint,
  p_user_id uuid,
  p_status public.attendance_status,
  p_note text DEFAULT NULL
)
  RETURNS public.attendance
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  result public.attendance;
begin
  if not public.is_admin() then
    raise exception 'ATTENDANCE_NOT_ADMIN' using hint = 'Only admins can edit attendance.';
  end if;

  if not exists (select 1 from public.events where event_id = p_event_id and takes_attendance) then
    raise exception 'ATTENDANCE_EVENT_NOT_TRACKED' using hint = 'This event does not take attendance.';
  end if;

  if not private.is_approved_student(p_user_id) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  insert into public.attendance as a (event_id, user_id, status, method, recorded_by, recorded_at, note)
  values (p_event_id, p_user_id, p_status, 'manual', auth.uid(), now(), p_note)
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        method = excluded.method,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at,
        note = excluded.note
  returning * into result;

  return result;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_my_attendance_token() FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.scan_student(bigint, text) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.record_scan(bigint, text, public.attendance_status) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.set_attendance(bigint, uuid, public.attendance_status, text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.get_my_attendance_token() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.scan_student(bigint, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.record_scan(bigint, text, public.attendance_status) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.set_attendance(bigint, uuid, public.attendance_status, text) TO "authenticated";

-- Reporting -----------------------------------------------------------------

-- One row per attendance record with the details admins export. Runs with the
-- caller's permissions, so students only see their own rows. Export with
-- supabase.from("attendance_report").select().eq("event_id", id).csv().
CREATE OR REPLACE VIEW "public"."attendance_report"
  WITH (security_invoker = true)
  AS
  SELECT
    a.event_id,
    e.event_name,
    e.event_start,
    a.user_id,
    s.student_id,
    u.last_name,
    u.first_name,
    c.name AS course,
    y.name AS year_level,
    a.status,
    a.method,
    a.recorded_at,
    nullif(trim(concat_ws(' ', r.first_name, r.last_name)), '') AS recorded_by,
    a.note
  FROM public.attendance a
  JOIN public.events e ON e.event_id = a.event_id
  JOIN public.users u ON u.id = a.user_id
  LEFT JOIN public.students s ON s.id = a.user_id
  LEFT JOIN public.courses c ON c.id = s.course
  LEFT JOIN public.yearlevels y ON y.id = s.year_level
  LEFT JOIN public.users r ON r.id = a.recorded_by;

REVOKE ALL ON TABLE "public"."attendance_report" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."attendance_report" TO "authenticated";
