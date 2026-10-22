-- Static attendance passes. Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(21);

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

CREATE TEMP TABLE passes (name text PRIMARY KEY, pass text);
GRANT ALL ON passes TO "authenticated";

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Getting a pass --------------------------------------------------------------

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_my_static_pass()', 'execute'),
  'anon cannot request a static pass'
);
SELECT is(
  (SELECT accepts_static_pass FROM public.events WHERE event_id = 9102),
  false,
  'events refuse static passes unless an admin allows them'
);

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000005');
SELECT throws_ok(
  'SELECT public.get_my_static_pass()',
  'P0001', 'ATTENDANCE_NOT_STUDENT',
  'pending students get no static pass'
);
RESET ROLE;

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000003');
INSERT INTO passes VALUES ('original', public.get_my_static_pass());
SELECT matches(
  (SELECT pass FROM passes WHERE name = 'original'),
  '^s1\.b0000000-0000-0000-0000-000000000003\.[A-Za-z0-9_-]{22}$',
  'approved students get a signed static pass'
);
SELECT is(
  public.get_my_static_pass(),
  (SELECT pass FROM passes WHERE name = 'original'),
  'the pass stays the same between calls'
);
INSERT INTO passes SELECT 'rotating', token FROM public.get_my_attendance_token();
RESET ROLE;

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000004');
INSERT INTO passes VALUES ('student2', public.get_my_static_pass());
RESET ROLE;

INSERT INTO passes VALUES
  ('forged', (SELECT left(pass, -2) || CASE WHEN right(pass, 2) = 'AA' THEN 'BB' ELSE 'AA' END FROM passes WHERE name = 'original')),
  -- Student 2's signature on student 1's ID.
  ('swapped', 's1.b0000000-0000-0000-0000-000000000003.' || split_part((SELECT pass FROM passes WHERE name = 'student2'), '.', 3)),
  -- Anyone can write a student number into a QR; that alone must not work.
  ('unsigned', 's1.b0000000-0000-0000-0000-000000000003.');

-- Scanning --------------------------------------------------------------------

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000002');

SELECT results_eq(
  $$SELECT first_name, student_id, status, method FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'original'))$$,
  $$VALUES ('Stu'::text, 'STATIC-0003'::text, NULL::public.attendance_status, 'static'::public.attendance_method)$$,
  'scanners see who a static pass belongs to, flagged as static'
);
SELECT results_eq(
  $$SELECT student_id, method FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'rotating'))$$,
  $$VALUES ('STATIC-0003'::text, 'scan'::public.attendance_method)$$,
  'rotating codes still work at events that allow static passes'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9102, (SELECT pass FROM passes WHERE name = 'original'))$$,
  'P0001', 'ATTENDANCE_STATIC_NOT_ALLOWED',
  'live-only events refuse static passes'
);
SELECT throws_ok(
  $$SELECT * FROM public.record_scan(9102, (SELECT pass FROM passes WHERE name = 'original'), 'present')$$,
  'P0001', 'ATTENDANCE_STATIC_NOT_ALLOWED',
  'live-only events refuse to record static passes'
);
SELECT results_eq(
  $$SELECT student_id, method FROM public.scan_student(9102, (SELECT pass FROM passes WHERE name = 'rotating'))$$,
  $$VALUES ('STATIC-0003'::text, 'scan'::public.attendance_method)$$,
  'live-only events still take rotating codes'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'forged'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'tampered static passes are rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'swapped'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'one student''s signature does not work for another'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'unsigned'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'a student ID without a signature is rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, replace((SELECT pass FROM passes WHERE name = 'original'), 's1.', 'v1.'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'a static pass cannot pass as a rotating code'
);

SELECT results_eq(
  $$SELECT status, method, recorded_by FROM public.record_scan(9101, (SELECT pass FROM passes WHERE name = 'original'), 'present')$$,
  $$VALUES ('present'::public.attendance_status, 'static'::public.attendance_method, 'b0000000-0000-0000-0000-000000000002'::uuid)$$,
  'a static check-in is saved with method static'
);
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

-- Resetting -------------------------------------------------------------------

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$SELECT public.reset_static_pass('b0000000-0000-0000-0000-000000000003')$$,
  'P0001', 'ATTENDANCE_NOT_ADMIN',
  'students cannot reset someone else''s pass'
);
RESET ROLE;

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000003');
SELECT public.reset_static_pass();
SELECT isnt(
  public.get_my_static_pass(),
  (SELECT pass FROM passes WHERE name = 'original'),
  'resetting gives the student a new pass'
);
RESET ROLE;

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000002');
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'original'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'the old pass stops working after a reset'
);
RESET ROLE;

SELECT pg_temp.login('b0000000-0000-0000-0000-000000000001');
SELECT public.reset_static_pass('b0000000-0000-0000-0000-000000000004');
RESET ROLE;
SELECT pg_temp.login('b0000000-0000-0000-0000-000000000002');
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9101, (SELECT pass FROM passes WHERE name = 'student2'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'admins can reset any student''s pass'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
