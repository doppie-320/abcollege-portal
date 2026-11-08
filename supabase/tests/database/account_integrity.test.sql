-- Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(5);

-- Fixtures --------------------------------------------------------------------
-- The on_user_register trigger adds the users and a pending user_requests row.

INSERT INTO public.courses (id, name, short_name) VALUES (9301, 'Test Course', 'TC');
INSERT INTO public.yearlevels (id, name) VALUES (9301, 'Test Year');

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'member@pgtap-integrity.local', '{"first_name":"Mem","last_name":"Ber"}'),
  ('f0000000-0000-0000-0000-000000000002', 'other@pgtap-integrity.local',  '{"first_name":"Oth","last_name":"Er"}');

INSERT INTO public.students (id, student_id, year_level, course) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'PGTAPINT1', 9301, 9301);

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- users.email_address --------------------------------------------------------

SELECT pg_temp.login('f0000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$UPDATE public.users SET first_name = 'Renamed', avatar_path = NULL
    WHERE id = 'f0000000-0000-0000-0000-000000000001'$$,
  'members can still change their name and avatar'
);

SELECT throws_ok(
  $$UPDATE public.users SET email_address = 'someone-else@pgtap-integrity.local'
    WHERE id = 'f0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'members cannot change the email copied from their account'
);

RESET role;

SELECT is(
  (SELECT first_name FROM public.users WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'Renamed',
  'the name change was saved'
);

UPDATE auth.users SET email = 'moved@pgtap-integrity.local'
WHERE id = 'f0000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT email_address FROM public.users WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'moved@pgtap-integrity.local',
  'a changed account email is copied to users'
);

-- Student IDs ------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.students (id, student_id, year_level, course)
    VALUES ('f0000000-0000-0000-0000-000000000002', 'pgtapint1', 9301, 9301)$$,
  '23505',
  NULL,
  'a student ID that differs only by case is rejected'
);

SELECT * FROM finish();
ROLLBACK;
