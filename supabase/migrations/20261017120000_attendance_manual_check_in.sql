-- Manual check-in by school student ID, for a student who can't show their QR
-- (dead phone, no data). Scanners look the student up with
-- lookup_student_by_id(), compare the photo as usual, then accept or reject
-- with record_by_student_id().
--
-- This skips the rotating QR, which is what proves the student is physically
-- there, so it is limited the same way scanning is: only admins and the
-- event's assigned scanners, only while check-in is open. Rows are saved with
-- method 'manual', the scanner as recorded_by and an optional note, so admins
-- can audit them on the roster.

-- Raises unless p_student_id belongs to an approved student.
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
  select s.id into student from public.students s where s.student_id = btrim(p_student_id);

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

-- Scanner: who a typed school ID belongs to, same shape as scan_student().
-- Records nothing.
CREATE OR REPLACE FUNCTION public.lookup_student_by_id (
  p_event_id bigint,
  p_student_id text
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
  -- Checked first so people who can't scan can't probe which IDs exist.
  perform private.assert_can_scan(p_event_id);
  student := private.find_student_by_school_id(p_student_id);

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

-- Scanner: accept or reject a student by school ID. Like record_scan(), a
-- present record is never downgraded to rejected.
CREATE OR REPLACE FUNCTION public.record_by_student_id (
  p_event_id bigint,
  p_student_id text,
  p_decision public.attendance_status,
  p_note text DEFAULT NULL
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
  student := private.find_student_by_school_id(p_student_id);

  insert into public.attendance as a (event_id, user_id, status, method, recorded_by, recorded_at, note)
  values (p_event_id, student, p_decision, 'manual', auth.uid(), now(), nullif(btrim(p_note), ''))
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        method = excluded.method,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at,
        note = excluded.note
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

REVOKE ALL ON FUNCTION public.lookup_student_by_id(bigint, text) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.record_by_student_id(bigint, text, public.attendance_status, text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.lookup_student_by_id(bigint, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.record_by_student_id(bigint, text, public.attendance_status, text) TO "authenticated";
