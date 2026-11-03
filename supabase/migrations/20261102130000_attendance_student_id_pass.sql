-- The static pass is now just the student's school ID in a QR, so it can be
-- printed and laminated once and never needs reissuing. That replaces the
-- signed s1. pass: there is no secret to reset any more.
--
-- Anyone who knows a student's ID can make their QR, the same as typing the ID
-- into the manual check-in, so scanners still compare the photo before
-- accepting. Events that need more turn accepts_static_pass off and take only
-- the rotating code.

-- Rotating codes start with v1.; anything else is read as a school ID.
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
  found_student uuid;
begin
  if p_code is null or left(p_code, 3) = 'v1.' then
    return query select private.verify_attendance_token(p_code, p_max_age), 'scan'::public.attendance_method;
    return;
  end if;

  select s.id into found_student from public.students s where s.student_id = btrim(p_code);
  if not found then
    raise exception 'ATTENDANCE_TOKEN_INVALID' using hint = 'This is not a valid attendance QR code.';
  end if;

  if not coalesce((select e.accepts_static_pass from public.events e where e.event_id = p_event_id), false) then
    raise exception 'ATTENDANCE_STATIC_NOT_ALLOWED' using hint = 'This event only accepts the live QR code from the student''s phone.';
  end if;

  return query select found_student, 'static'::public.attendance_method;
end;
$function$;

REVOKE ALL ON FUNCTION private.read_scanned_code(bigint, text, integer) FROM PUBLIC, "anon", "authenticated";

DROP FUNCTION IF EXISTS public.get_my_static_pass();
DROP FUNCTION IF EXISTS public.reset_static_pass(uuid);
DROP FUNCTION IF EXISTS private.sign_static_pass(uuid);
