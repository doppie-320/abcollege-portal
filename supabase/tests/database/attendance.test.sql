-- Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(34);

-- Fixtures --------------------------------------------------------------------

INSERT INTO public.courses (id, name) VALUES (9001, 'Test Course');
INSERT INTO public.yearlevels (id, name) VALUES (9001, 'Test Year');

-- The signup trigger creates public.users and a pending user_requests row.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@pgtap.local',    '{"first_name":"Ada","last_name":"Admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'scanner@pgtap.local',  '{"first_name":"Sam","last_name":"Scanner"}'),
  ('a0000000-0000-0000-0000-000000000003', 'student@pgtap.local',  '{"first_name":"Stu","last_name":"Dent"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pending@pgtap.local',  '{"first_name":"Pen","last_name":"Ding"}'),
  ('a0000000-0000-0000-0000-000000000005', 'outsider@pgtap.local', '{"first_name":"Out","last_name":"Sider"}'),
  ('a0000000-0000-0000-0000-000000000006', 'nophone@pgtap.local',  '{"first_name":"No","last_name":"Phone"}');

UPDATE public.user_requests SET request_status = 'accept'
WHERE user_id <> 'a0000000-0000-0000-0000-000000000004';

INSERT INTO public.admins (id) VALUES ('a0000000-0000-0000-0000-000000000001');

INSERT INTO public.students (id, student_id, year_level, course) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'TEST-0003', 9001, 9001),
  ('a0000000-0000-0000-0000-000000000004', 'TEST-0004', 9001, 9001),
  ('a0000000-0000-0000-0000-000000000006', 'TEST-0006', 9001, 9001);

INSERT INTO public.events (event_id, event_name, event_start, event_end, tag, takes_attendance) VALUES
  (9001, 'Open event',      now() - interval '10 minutes', now() + interval '1 hour', 'GENERAL', true),
  (9002, 'Untracked event', now() - interval '10 minutes', now() + interval '1 hour', 'GENERAL', false),
  (9003, 'Past event',      now() - interval '3 hours',    now() - interval '2 hours', 'GENERAL', true),
  (9004, 'Future event',    now() + interval '2 hours',    now() + interval '3 hours', 'GENERAL', true);

INSERT INTO public.event_scanners (event_id, user_id) VALUES
  (9001, 'a0000000-0000-0000-0000-000000000002'),
  (9003, 'a0000000-0000-0000-0000-000000000002'),
  (9004, 'a0000000-0000-0000-0000-000000000002');

CREATE TEMP TABLE tokens (name text PRIMARY KEY, token text);
GRANT ALL ON tokens TO "authenticated";

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Students --------------------------------------------------------------------

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_my_attendance_token()', 'execute'),
  'anon cannot request a QR token'
);

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  'SELECT * FROM public.get_my_attendance_token()',
  'P0001', 'ATTENDANCE_NOT_STUDENT',
  'pending students get no QR token'
);
RESET ROLE;

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000003');
INSERT INTO tokens SELECT 'current', token FROM public.get_my_attendance_token();
SELECT matches(
  (SELECT token FROM tokens WHERE name = 'current'),
  '^v1\.a0000000-0000-0000-0000-000000000003\.[0-9]+\.[A-Za-z0-9_-]{22}$',
  'approved students get a signed token'
);
SELECT ok(
  (SELECT expires_at > now() AND expires_at <= now() + interval '30 seconds' FROM public.get_my_attendance_token()),
  'tokens expire within 30 seconds'
);
SELECT throws_ok(
  $$INSERT INTO public.attendance (event_id, user_id, status, method) VALUES (9001, 'a0000000-0000-0000-0000-000000000003', 'present', 'scan')$$,
  '42501', NULL,
  'students cannot write attendance directly'
);
RESET ROLE;

-- Tokens signed for earlier windows, and tampered ones.
INSERT INTO tokens VALUES
  ('2 windows old', private.sign_attendance_token('a0000000-0000-0000-0000-000000000003', private.attendance_token_window() - 2)),
  ('4 windows old', private.sign_attendance_token('a0000000-0000-0000-0000-000000000003', private.attendance_token_window() - 4)),
  ('forged', (SELECT left(token, -2) || CASE WHEN right(token, 2) = 'AA' THEN 'BB' ELSE 'AA' END FROM tokens WHERE name = 'current')),
  ('other student', replace((SELECT token FROM tokens WHERE name = 'current'), '-000000000003.', '-000000000004.'));

-- Scanning --------------------------------------------------------------------

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000002');

SELECT results_eq(
  $$SELECT first_name, student_id, course, status FROM public.scan_student(9001, (SELECT token FROM tokens WHERE name = 'current'))$$,
  $$VALUES ('Stu'::text, 'TEST-0003'::text, 'Test Course'::text, NULL::public.attendance_status)$$,
  'scanners see who a QR belongs to'
);
SELECT is(
  (SELECT count(*)::int FROM public.attendance),
  0,
  'looking up a QR records nothing'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9001, (SELECT token FROM tokens WHERE name = 'forged'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'tampered signatures are rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9001, (SELECT token FROM tokens WHERE name = 'other student'))$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'a signature cannot be reused for another student'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9001, '{"studentId":"a0000000-0000-0000-0000-000000000003"}')$$,
  'P0001', 'ATTENDANCE_TOKEN_INVALID',
  'legacy-style static QR payloads are rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9001, (SELECT token FROM tokens WHERE name = '2 windows old'))$$,
  'P0001', 'ATTENDANCE_TOKEN_EXPIRED',
  'scanning needs a QR from the last minute'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9002, (SELECT token FROM tokens WHERE name = 'current'))$$,
  'P0001', 'ATTENDANCE_EVENT_NOT_TRACKED',
  'events without attendance cannot be scanned for'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9003, (SELECT token FROM tokens WHERE name = 'current'))$$,
  'P0001', 'ATTENDANCE_CLOSED',
  'scanning is refused after check-in closes'
);
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9004, (SELECT token FROM tokens WHERE name = 'current'))$$,
  'P0001', 'ATTENDANCE_NOT_OPEN',
  'scanning is refused before check-in opens'
);

-- Recording -------------------------------------------------------------------

SELECT is(
  (SELECT status FROM public.record_scan(9001, (SELECT token FROM tokens WHERE name = 'current'), 'rejected')),
  'rejected'::public.attendance_status,
  'scanners can reject a student'
);
SELECT results_eq(
  $$SELECT status, method, recorded_by FROM public.record_scan(9001, (SELECT token FROM tokens WHERE name = '2 windows old'), 'present')$$,
  $$VALUES ('present'::public.attendance_status, 'scan'::public.attendance_method, 'a0000000-0000-0000-0000-000000000002'::uuid)$$,
  'a rejection can be replaced by an acceptance, using a QR up to ~2 minutes old'
);
SELECT is(
  (SELECT status FROM public.record_scan(9001, (SELECT token FROM tokens WHERE name = 'current'), 'rejected')),
  'present'::public.attendance_status,
  'a later rejection does not undo a present record'
);
SELECT throws_ok(
  $$SELECT * FROM public.record_scan(9001, (SELECT token FROM tokens WHERE name = '4 windows old'), 'present')$$,
  'P0001', 'ATTENDANCE_TOKEN_EXPIRED',
  'recording refuses QRs older than ~2 minutes'
);
SELECT is(
  (SELECT count(*)::int FROM public.attendance),
  1,
  'scanners can read attendance for their events, one row per student'
);
SELECT throws_ok(
  $$INSERT INTO public.event_scanners (event_id, user_id) VALUES (9002, 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', NULL,
  'scanners cannot assign themselves to events'
);
RESET ROLE;

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000005');
SELECT throws_ok(
  $$SELECT * FROM public.scan_student(9001, (SELECT token FROM tokens WHERE name = 'current'))$$,
  'P0001', 'ATTENDANCE_NOT_SCANNER',
  'unassigned users cannot scan'
);
SELECT is(
  (SELECT count(*)::int FROM public.attendance),
  0,
  'other users cannot read attendance'
);
RESET ROLE;

-- Manual check-in by school ID ------------------------------------------------

SELECT ok(
  NOT has_function_privilege('anon', 'public.record_by_student_id(bigint, text, public.attendance_status, text, boolean)', 'execute'),
  'anon cannot check students in by ID'
);

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000002');
SELECT results_eq(
  $$SELECT first_name, student_id, status FROM public.lookup_student_by_id(9001, ' TEST-0003 ')$$,
  $$VALUES ('Stu'::text, 'TEST-0003'::text, 'present'::public.attendance_status)$$,
  'scanners can look a student up by school ID'
);
SELECT throws_ok(
  $$SELECT * FROM public.lookup_student_by_id(9001, 'NOPE-0000')$$,
  'P0001', 'ATTENDANCE_STUDENT_NOT_FOUND',
  'unknown school IDs are reported'
);
SELECT throws_ok(
  $$SELECT * FROM public.lookup_student_by_id(9001, 'TEST-0004')$$,
  'P0001', 'ATTENDANCE_NOT_STUDENT',
  'pending students cannot be checked in by ID'
);
SELECT throws_ok(
  $$SELECT * FROM public.record_by_student_id(9003, 'TEST-0006', 'present')$$,
  'P0001', 'ATTENDANCE_CLOSED',
  'checking in by ID follows the check-in window'
);
SELECT results_eq(
  $$SELECT status, method, recorded_by, note FROM public.record_by_student_id(9001, 'TEST-0006', 'present', '  Phone died ')$$,
  $$VALUES ('present'::public.attendance_status, 'manual'::public.attendance_method, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Phone died'::text)$$,
  'scanners can check a student in by ID, saved as manual with a note'
);
SELECT results_eq(
  $$SELECT status, method FROM public.record_by_student_id(9001, 'TEST-0003', 'rejected')$$,
  $$VALUES ('present'::public.attendance_status, 'scan'::public.attendance_method)$$,
  'rejecting by ID does not undo a present record'
);
RESET ROLE;

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000005');
SELECT throws_ok(
  $$SELECT * FROM public.lookup_student_by_id(9001, 'TEST-0003')$$,
  'P0001', 'ATTENDANCE_NOT_SCANNER',
  'unassigned users cannot look students up by ID'
);
RESET ROLE;

-- Admins ----------------------------------------------------------------------

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000003');
SELECT throws_ok(
  $$SELECT * FROM public.set_attendance(9001, 'a0000000-0000-0000-0000-000000000003', 'present')$$,
  'P0001', 'ATTENDANCE_NOT_ADMIN',
  'students cannot edit attendance'
);
RESET ROLE;

SELECT pg_temp.login('a0000000-0000-0000-0000-000000000001');
SELECT results_eq(
  $$SELECT status, method, note FROM public.set_attendance(9001, 'a0000000-0000-0000-0000-000000000003', 'rejected', 'Left early')$$,
  $$VALUES ('rejected'::public.attendance_status, 'manual'::public.attendance_method, 'Left early'::text)$$,
  'admins can override a record with a note'
);
SELECT results_eq(
  $$SELECT event_name, student_id, last_name, course, recorded_by FROM public.attendance_report WHERE event_id = 9001 AND student_id = 'TEST-0003'$$,
  $$VALUES ('Open event'::text, 'TEST-0003'::text, 'Dent'::text, 'Test Course'::text, 'Ada Admin'::text)$$,
  'the report joins student and recorder details'
);
RESET ROLE;

SELECT throws_ok(
  'DELETE FROM public.events WHERE event_id = 9001',
  '23503', NULL,
  'events with attendance cannot be deleted by accident'
);

SELECT * FROM finish();
ROLLBACK;
