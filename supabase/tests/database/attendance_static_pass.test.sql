-- Static attendance passes (the student's school ID in a QR). Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

-- Fixtures --------------------------------------------------------------------

INSERT INTO public.courses (id, name) VALUES (9101, 'Static Course');
INSERT INTO public.yearlevels (id, name) VALUES (9101, 'Static Year');

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'admin@static.pgtap.local',    '{"first_name":"Ada","last_name":"Admin"}'),
  ('b0000000-0000-0000-0000-000000000002', 'scanner@static.pgtap.local',  '{"first_name":"Sam","last_name":"Scanner"}'),
  ('b0000000-0000-0000-0000-000000000003', 'student@static.pgtap.local',  '{"first_name":"Stu","last_name":"Dent"}'),
  ('b0000000-0000-0000-0000-000000000004', 'student2@static.pgtap.local', '{"first_name":"Sec","last_name":"Ond"}'),
  ('b0000000-0000-0000-0000-000000000005', 'pending@static.pgtap.local',  '{"first_name":"Pen","last_name":"Ding"}');

UPDATE public.user_requests SET request_status = 'accept'
WHERE user_id <> 'b0000000-0000-0000-0000-000000000005';

INSERT INTO public.admins (id) VALUES ('b0000000-0000-0000-0000-000000000001');

INSERT INTO public.students (id, student_id, year_level, course) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'STATIC-0003', 9101, 9101),
  ('b0000000-0000-0000-0000-000000000004', 'STATIC-0004', 9101, 9101),
  ('b0000000-0000-0000-0000-000000000005', 'STATIC-0005', 9101, 9101);

INSERT INTO public.events (event_id, event_name, event_start, event_end, tag, takes_attendance, accepts_static_pass) VALUES
  (9101, 'Static allowed', now() - interval '10 minutes', now() + interval '1 hour', 'GENERAL', true, true),
  (9102, 'Live only',      now() - interval '10 minutes', now() + interval '1 hour', 'GENERAL', true, false);

INSERT INTO public.event_scanners (event_id, user_id) VALUES
  (9101, 'b0000000-0000-0000-0000-000000000002'),
  (9102, 'b0000000-0000-0000-0000-000000000002');

CREATE TEMP TABLE tokens (name text PRIMARY KEY, token text);
GRANT ALL ON tokens TO "authenticated";

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

SELECT col_default_is(
  'public', 'events', 'accepts_static_pass', 'true',
  'events accept static passes unless an admin turns them off'
);
SELECT hasnt_function('public', 'get_my_static_pass', 'signed static passes are no longer issued');
SELECT hasnt_function('public', 'reset_static_pass', 'there is no static pass to reset');

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000003');
INSERT INTO tokens SELECT 'rotating', token FROM public.get_my_attendance_token();
RESET ROLE;

-- Scanning --------------------------------------------------------------------

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000002');

SELECT results_eq(
  $$SELECT first_name, student_id, status, method FROM public.scan_student(9101, 'STATIC-0003')$$,
  $$VALUES ('Stu'::text, 'STATIC-0003'::text, NULL::public.attendance_status, 'static'::public.attendance_method)$$,
  'scanners see who a student ID QR belongs to, flagged as static'
);
SELECT results_eq(
  $$SELECT student_id FROM public.scan_student(9101, '  STATIC-0003 ')$$,
  $$VALUES ('STATIC-0003'::text)$$,
  'whitespace around the ID is ignored'
);
SELECT results_eq(
  $$SELECT student_id, method FROM public.scan_student(9101, (SELECT token FROM tokens WHERE name = 'rotating'))$$,
  $$VALUES ('STATIC-0003'::text, 'scan'::public.attendance_method)$$,
  'rotating codes still work at events that allow static passes'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9102, 'STATIC-0003')$$,
  'P0001', 'ATTENDANCE_STATIC_NOT_ALLOWED',
  'live-only events refuse static passes'
);
SELECT throws_ok(
  $$SELECT * FROM public.record_scan(9102, 'STATIC-0003', 'present')$$,
  'P0001', 'ATTENDANCE_STATIC_NOT_ALLOWED',
  'live-only events refuse to record static passes'
);
SELECT results_eq(
  $$SELECT student_id, method FROM public.scan_student(9102, (SELECT token FROM tokens WHERE name = 'rotating'))$$,
  $$VALUES ('STATIC-0003'::text, 'scan'::public.attendance_method)$$,
  'live-only events still take rotating codes'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, 'NOPE-0000')$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'a QR that is no student''s ID is rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, 'STATIC-0005')$$,
  'P0001', 'ATTENDANCE_NOT_STUDENT',
  'pending students cannot be checked in by ID'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, 'v1.STATIC-0003')$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'an ID cannot pass as a rotating code'
);

SELECT results_eq(
  $$SELECT status, method, recorded_by FROM public.record_scan(9101, 'STATIC-0003', 'present')$$,
  $$VALUES ('present'::public.attendance_status, 'static'::public.attendance_method, 'b0000000-0000-0000-0000-000000000002'::uuid)$$,
  'a static check-in is saved with method static'
);
SELECT public.record_scan(9101, 'STATIC-0003', 'present');
SELECT is(
  (SELECT count(*)::int FROM public.attendance WHERE event_id = 9101),
  1,
  'scanning a static pass again does not add a second record'
);
RESET ROLE;

SELECT is(
  (SELECT method FROM public.attendance_history WHERE event_id = 9101 ORDER BY id DESC LIMIT 1),
  'static'::public.attendance_method,
  'the history records the static check-in'
);

-- Only scanners ---------------------------------------------------------------

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$SELECT * FROM public.record_scan(9101, 'STATIC-0004', 'present')$$,
  'P0001', 'ATTENDANCE_NOT_SCANNER',
  'students cannot check themselves in with their own ID'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
