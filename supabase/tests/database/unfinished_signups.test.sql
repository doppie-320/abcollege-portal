-- Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

-- Fixtures --------------------------------------------------------------------
-- The on_user_register trigger adds the users and a pending user_requests row.

INSERT INTO public.courses (id, name, short_name) VALUES (9201, 'Test Course', 'TC');
INSERT INTO public.yearlevels (id, name) VALUES (9201, 'Test Year');

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at) VALUES
  -- Signed in with Google just now, never filled in the form.
  ('e0000000-0000-0000-0000-000000000001', 'fresh@pgtap-unfinished.local',   '{"full_name":"Fresh Google"}', now(), now()),
  -- Same, but two days ago.
  ('e0000000-0000-0000-0000-000000000002', 'old@pgtap-unfinished.local',     '{"full_name":"Old Google"}', now() - interval '2 days', now() - interval '2 days'),
  -- Two days old, but signed in again an hour ago (still filling in the form).
  ('e0000000-0000-0000-0000-000000000003', 'back@pgtap-unfinished.local',    '{"full_name":"Back Again"}', now() - interval '2 days', now() - interval '1 hour'),
  -- Finished sign-up: has student details.
  ('e0000000-0000-0000-0000-000000000004', 'student@pgtap-unfinished.local', '{"first_name":"Stu","last_name":"Dent"}', now() - interval '2 days', now() - interval '2 days'),
  -- Admin with no student details.
  ('e0000000-0000-0000-0000-000000000005', 'admin@pgtap-unfinished.local',   '{"first_name":"Ada","last_name":"Admin"}', now() - interval '2 days', now() - interval '2 days'),
  -- Accepted with no student details.
  ('e0000000-0000-0000-0000-000000000006', 'accepted@pgtap-unfinished.local', '{"first_name":"Acc","last_name":"Epted"}', now() - interval '2 days', now() - interval '2 days');

INSERT INTO public.students (id, student_id, year_level, course) VALUES
  ('e0000000-0000-0000-0000-000000000004', 'PGTAPUNF1', 9201, 9201);

INSERT INTO public.admins (id) VALUES ('e0000000-0000-0000-0000-000000000005');
UPDATE public.user_requests SET request_status = 'accept'
WHERE user_id = 'e0000000-0000-0000-0000-000000000006';

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

CREATE FUNCTION pg_temp.exists(uid uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = uid);
$$;

-- delete_own_unfinished_signup ------------------------------------------------

SELECT pg_temp.login('e0000000-0000-0000-0000-000000000004');
SELECT is(public.delete_own_unfinished_signup(), false, 'a finished sign-up is not deleted');

SELECT pg_temp.login('e0000000-0000-0000-0000-000000000005');
SELECT is(public.delete_own_unfinished_signup(), false, 'an admin is not deleted');

SELECT pg_temp.login('e0000000-0000-0000-0000-000000000001');
SELECT is(public.delete_own_unfinished_signup(), true, 'an unfinished Google sign-up deletes itself');

SELECT throws_ok(
  'SELECT public.delete_abandoned_signups()',
  '42501',
  NULL,
  'signed-in users cannot run the cleanup job'
);

RESET role;

SELECT is(pg_temp.exists('e0000000-0000-0000-0000-000000000001'), false, 'the unfinished auth user is gone');
SELECT is((SELECT count(*) FROM public.users WHERE id = 'e0000000-0000-0000-0000-000000000001')::int, 0, 'and its users row');

-- delete_abandoned_signups ----------------------------------------------------

SELECT is(public.delete_abandoned_signups() >= 1, true, 'the job reports what it deleted');
SELECT is(pg_temp.exists('e0000000-0000-0000-0000-000000000002'), false, 'an old unfinished sign-up is deleted');

SELECT ok(
  pg_temp.exists('e0000000-0000-0000-0000-000000000003')
  AND pg_temp.exists('e0000000-0000-0000-0000-000000000004')
  AND pg_temp.exists('e0000000-0000-0000-0000-000000000005')
  AND pg_temp.exists('e0000000-0000-0000-0000-000000000006'),
  'recently active, finished, admin and accepted accounts are kept'
);

SELECT * FROM finish();
ROLLBACK;
