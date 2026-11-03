-- Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

-- Fixtures --------------------------------------------------------------------

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'admin@pgtap-delete.local',   '{"first_name":"Ada","last_name":"Admin"}'),
  ('d0000000-0000-0000-0000-000000000002', 'student@pgtap-delete.local', '{"first_name":"Stu","last_name":"Dent"}');

INSERT INTO public.admins (id) VALUES ('d0000000-0000-0000-0000-000000000001');

INSERT INTO public.events (event_id, event_name, event_start, event_end, tag, takes_attendance) VALUES
  (9101, 'Event with attendance', now() - interval '1 hour', now() + interval '1 hour', 'EVENT', true),
  (9102, 'Event without',         now() - interval '1 hour', now() + interval '1 hour', 'EVENT', true);

INSERT INTO public.attendance (event_id, user_id, status, method) VALUES
  (9101, 'd0000000-0000-0000-0000-000000000002', 'present', 'manual');

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Tests -----------------------------------------------------------------------

SELECT pg_temp.login('d0000000-0000-0000-0000-000000000001');

SELECT throws_ok(
  'DELETE FROM public.events WHERE event_id = 9101',
  '23503',
  NULL,
  'a plain delete still refuses to drop attendance'
);

SELECT pg_temp.login('d0000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  'SELECT public.delete_event_with_attendance(9101)',
  'EVENT_NOT_ADMIN',
  'non-admins cannot delete events with attendance'
);

SELECT pg_temp.login('d0000000-0000-0000-0000-000000000001');

SELECT is(public.delete_event_with_attendance(9101), 1, 'returns how many records were removed');
SELECT is(public.delete_event_with_attendance(9102), 0, 'works on events without attendance');

RESET role;

SELECT is((SELECT count(*) FROM public.events WHERE event_id IN (9101, 9102))::int, 0, 'the events are gone');
SELECT is((SELECT count(*) FROM public.attendance WHERE event_id = 9101)::int, 0, 'their attendance is gone');
SELECT is((SELECT count(*) FROM public.attendance_history WHERE event_id = 9101)::int, 0, 'their history is gone');

SELECT * FROM finish();
ROLLBACK;
