-- Static attendance passes: a QR that doesn't change, for students who want to
-- print it or show it without data. It is signed with the same per-student
-- secret as the rotating code, so it can't be made up from a student number,
-- but a copy keeps working until the pass is reset. So:
--
--   - Events refuse static passes unless an admin turns accepts_static_pass on.
--   - Check-ins made with one are saved with method 'static', so the roster
--     and export show how each student got in.
--   - A student (or an admin) can reset the pass; that replaces the secret,
--     which voids every copy of the old pass.
--
-- Scanners don't pick a mode: scan_student() and record_scan() accept either
-- kind of code and tell them apart by prefix (v1. rotating, s1. static).

ALTER TYPE public.attendance_method ADD VALUE IF NOT EXISTS 'static';

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "accepts_static_pass" boolean NOT NULL DEFAULT false;

-- Internal helpers ------------------------------------------------------------

-- Pass format: s1.<user id>.<first 16 bytes of HMAC-SHA256, base64url>. The
-- signed message starts with "static." so it can never equal a rotating
-- token's "<user id>.<window>".
CREATE OR REPLACE FUNCTION private.sign_static_pass (
  p_user_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select 's1.' || p_user_id || '.' || rtrim(translate(encode(
    substring(extensions.hmac(convert_to('static.' || p_user_id, 'UTF8'), s.secret, 'sha256') from 1 for 16),
    'base64'), '+/', '-_'), '=')
  from private.attendance_secrets s
  where s.user_id = p_user_id;
$function$;

-- Who a scanned code belongs to and how the check-in should be saved. Callers
-- run private.assert_can_scan() first. p_max_age only applies to rotating
-- codes; see private.verify_attendance_token().
CREATE OR REPLACE FUNCTION private.read_scanned_code (
  p_event_id bigint,
  p_code text,
  p_max_age integer
)
  RETURNS TABLE (
    student uuid,
    method  public.attendance_method
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  parts text[];
begin
  if p_code is null or left(p_code, 3) <> 's1.' then
    return query select private.verify_attendance_token(p_code, p_max_age), 'scan'::public.attendance_method;
    return;
  end if;

  if not coalesce((select e.accepts_static_pass from public.events e where e.event_id = p_event_id), false) then
    raise exception 'ATTENDANCE_STATIC_NOT_ALLOWED' using hint = 'This event only accepts the live QR code from the student''s phone.';
  end if;

  parts := string_to_array(p_code, '.');
  if array_length(parts, 1) <> 3
     or parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or private.sign_static_pass(parts[2]::uuid) is distinct from p_code then
    raise exception 'ATTENDANCE_TOKEN_INVALID' using hint = 'This is not a valid attendance QR code.';
  end if;

  return query select parts[2]::uuid, 'static'::public.attendance_method;
end;
$function$;

REVOKE ALL ON FUNCTION private.sign_static_pass(uuid) FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION private.read_scanned_code(bigint, text, integer) FROM PUBLIC, "anon", "authenticated";

-- Students --------------------------------------------------------------------

-- The student's static pass. Same for every call until it's reset.
CREATE OR REPLACE FUNCTION public.get_my_static_pass()
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not private.is_approved_student(auth.uid()) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'Only approved students have an attendance pass.';
  end if;

  insert into private.attendance_secrets (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return private.sign_static_pass(auth.uid());
end;
$function$;

-- Voids a student's static pass (and any rotating code still on screen) by
-- replacing their secret. Students reset their own; admins can reset anyone's.
CREATE OR REPLACE FUNCTION public.reset_static_pass (
  p_user_id uuid DEFAULT auth.uid()
)
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if p_user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'ATTENDANCE_NOT_ADMIN' using hint = 'Only admins can reset another student''s pass.';
  end if;

  if not private.is_approved_student(p_user_id) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  insert into private.attendance_secrets (user_id, secret, created_at)
  values (p_user_id, extensions.gen_random_bytes(32), now())
  on conflict (user_id) do update
    set secret = excluded.secret,
        created_at = excluded.created_at;
end;
$function$;

-- Scanning --------------------------------------------------------------------

-- Same as before, plus `method`: how the check-in would be saved, so the
-- scanner can warn when a static pass was shown. A new column changes the
-- return type, so the old function goes first.
DROP FUNCTION IF EXISTS public.scan_student(bigint, text);

CREATE FUNCTION public.scan_student (
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
    recorded_at timestamp with time zone,
    method      public.attendance_method
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  scanned record;
begin
  perform private.assert_can_scan(p_event_id);
  select * into scanned from private.read_scanned_code(p_event_id, p_token, 1);

  if not private.is_approved_student(scanned.student) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  return query
  select u.id, u.first_name, u.last_name, u.avatar_path, s.student_id, c.name, y.name, a.status, a.recorded_at, scanned.method
  from public.users u
  join public.students s on s.id = u.id
  left join public.courses c on c.id = s.course
  left join public.yearlevels y on y.id = s.year_level
  left join public.attendance a on a.event_id = p_event_id and a.user_id = u.id
  where u.id = scanned.student;
end;
$function$;

-- Scanner: accept or reject the scanned student. Unchanged except that a
-- static pass is saved as method 'static'.
CREATE OR REPLACE FUNCTION public.record_scan (
  p_event_id bigint,
  p_token text,
  p_decision public.attendance_status,
  p_override boolean DEFAULT false
)
  RETURNS public.attendance
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  scanned record;
  result public.attendance;
begin
  perform private.assert_can_scan(p_event_id);
  select * into scanned from private.read_scanned_code(p_event_id, p_token, 3);

  if not private.is_approved_student(scanned.student) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  insert into public.attendance as a (event_id, user_id, status, method, recorded_by, recorded_at)
  values (p_event_id, scanned.student, p_decision, scanned.method, auth.uid(), now())
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        method = excluded.method,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at,
        note = null
    where a.status <> 'present' or p_override
  returning * into result;

  -- Already present and not overridden: keep the original record.
  if not found then
    select * into result from public.attendance a
    where a.event_id = p_event_id and a.user_id = scanned.student;
  end if;

  return result;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_my_static_pass() FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.reset_static_pass(uuid) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.scan_student(bigint, text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.get_my_static_pass() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.reset_static_pass(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.scan_student(bigint, text) TO "authenticated";
