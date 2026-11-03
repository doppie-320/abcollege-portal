-- Student IDs are now saved in capitals, and the scanner capitalises what's
-- typed. IDs saved before that may still have lowercase letters, so look them
-- up ignoring case, preferring an exact match if two ever differ only by case.
-- Otherwise both functions are unchanged.

CREATE OR REPLACE FUNCTION private.find_student_by_school_id (
  p_student_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  student uuid;
begin
  select s.id into student
  from public.students s
  where upper(s.student_id) = upper(btrim(p_student_id))
  order by s.student_id = btrim(p_student_id) desc
  limit 1;

  if not found then
    raise exception 'ATTENDANCE_STUDENT_NOT_FOUND' using hint = 'No student has that ID. Check it against their school ID.';
  end if;

  if not private.is_approved_student(student) then
    raise exception 'ATTENDANCE_NOT_STUDENT' using hint = 'This account is not an approved student.';
  end if;

  return student;
end;
$function$;

REVOKE ALL ON FUNCTION private.find_student_by_school_id(text) FROM PUBLIC, "anon", "authenticated";

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

  select s.id into found_student
  from public.students s
  where upper(s.student_id) = upper(btrim(p_code))
  order by s.student_id = btrim(p_code) desc
  limit 1;
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
