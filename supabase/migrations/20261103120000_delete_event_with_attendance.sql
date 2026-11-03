-- Events that took attendance couldn't be deleted at all: attendance_event_id_fkey
-- is ON DELETE RESTRICT so that losing attendance is never an accident, and the
-- calendar only ever ran a plain DELETE on events.
--
-- This is the deliberate path. The calendar warns the admin how many records
-- go with the event, then calls this to remove them and the event together.
-- It runs with the caller's permissions, so the existing admin-only delete
-- policies on events and attendance still apply. Each removed record is
-- logged to attendance_history first, and that history goes with the event.

CREATE OR REPLACE FUNCTION public.delete_event_with_attendance (
  p_event_id bigint
)
  RETURNS integer -- attendance records removed
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  SET search_path TO ''
  AS $function$
declare
  removed integer;
begin
  if not public.is_admin() then
    raise exception 'EVENT_NOT_ADMIN' using hint = 'Only admins can delete events.';
  end if;

  -- Lock the event first: a scan landing between the two deletes waits on
  -- this lock, then fails its foreign key check instead of blocking the delete.
  perform 1 from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND' using hint = 'This event no longer exists.';
  end if;

  delete from public.attendance where event_id = p_event_id;
  get diagnostics removed = row_count;

  delete from public.events where event_id = p_event_id;

  return removed;
end;
$function$;

REVOKE ALL ON FUNCTION public.delete_event_with_attendance(bigint) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION public.delete_event_with_attendance(bigint) TO "authenticated";
