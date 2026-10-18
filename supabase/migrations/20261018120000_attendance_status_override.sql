-- Let scanners change a student's existing status for an event, both ways
-- (rejected -> present and present -> rejected).
--
-- Before this, a present record was never downgraded, so a student accepted by
-- mistake stayed present. The guard still holds by default: a status only
-- flips when the caller passes p_override, which the scanner does after the
-- officer confirms the change in a dialog that shows the current status. A
-- stale screen (another officer recorded the student meanwhile) still can't
-- silently overwrite a check-in.

-- New parameter means a new signature, so the old ones go first.
DROP FUNCTION IF EXISTS public.record_scan(bigint, text, public.attendance_status);
DROP FUNCTION IF EXISTS public.record_by_student_id(bigint, text, public.attendance_status, text);

-- Scanner: accept or reject the scanned student. Takes the token again rather
-- than a user id so scanners can't mark students who never showed a QR; it
-- stays valid for about two minutes to give the officer time to decide.
-- A present record is kept unless p_override is set.
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
    where a.status <> 'present' or p_override
  returning * into result;

  -- Already present and not overridden: keep the original record.
  if not found then
    select * into result from public.attendance a
    where a.event_id = p_event_id and a.user_id = student;
  end if;

  return result;
end;
$function$;

-- Scanner: accept or reject a student by school ID. Like record_scan(), a
-- present record is kept unless p_override is set.
CREATE OR REPLACE FUNCTION public.record_by_student_id (
  p_event_id bigint,
  p_student_id text,
  p_decision public.attendance_status,
  p_note text DEFAULT NULL,
  p_override boolean DEFAULT false
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
    where a.status <> 'present' or p_override
  returning * into result;

  -- Already present and not overridden: keep the original record.
  if not found then
    select * into result from public.attendance a
    where a.event_id = p_event_id and a.user_id = student;
  end if;

  return result;
end;
$function$;

REVOKE ALL ON FUNCTION public.record_scan(bigint, text, public.attendance_status, boolean) FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION public.record_by_student_id(bigint, text, public.attendance_status, text, boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.record_scan(bigint, text, public.attendance_status, boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.record_by_student_id(bigint, text, public.attendance_status, text, boolean) TO "authenticated";
