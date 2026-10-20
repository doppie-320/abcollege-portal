-- Local test data, loaded by `npx supabase db reset`. Never pushed to the
-- hosted project. Every account's password is: password123
--
--   admin@test.local     admin
--   scanner@test.local   approved member, assigned to scan the open event
--   student@test.local   approved student
--   student2@test.local  approved student
--   pending@test.local   student whose account request is still pending

INSERT INTO public.courses (name) VALUES ('BS Civil Engineering'), ('BS Computer Engineering');
INSERT INTO public.yearlevels (name) VALUES ('1st Year'), ('2nd Year'), ('3rd Year'), ('4th Year');

WITH accounts (id, email, first_name, last_name) AS (
  VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@test.local',    'Ada',     'Admin'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'scanner@test.local',  'Sam',     'Scanner'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'student@test.local',  'Stu',     'Dent'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'student2@test.local', 'Second',  'Student'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'pending@test.local',  'Pending', 'Person')
),
-- The signup trigger creates the public.users and pending user_requests rows.
new_users AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('first_name', first_name, 'last_name', last_name),
    now(), now(), '', '', '', ''
  FROM accounts
  RETURNING id, email
)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text, json_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
FROM new_users;

UPDATE public.user_requests SET request_status = 'accept'
WHERE user_id <> '00000000-0000-4000-8000-000000000005';

INSERT INTO public.admins (id) VALUES ('00000000-0000-4000-8000-000000000001');

INSERT INTO public.students (id, student_id, year_level, course)
SELECT s.id, s.student_id, (SELECT id FROM public.yearlevels WHERE name = '2nd Year'), (SELECT id FROM public.courses WHERE name = 'BS Computer Engineering')
FROM (VALUES
  ('00000000-0000-4000-8000-000000000003'::uuid, 'SOE12345678'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'SOE76543210'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'SOE18273645')
) AS s (id, student_id);

-- Check-in stays open for 30 days after a reset so the data doesn't go stale.
WITH new_events AS (
  INSERT INTO public.events (event_name, event_description, event_start, event_end, tag, takes_attendance)
  VALUES
    ('General Assembly (test)', 'Takes attendance; check-in is open.', now() - interval '1 hour', now() + interval '30 days', 'GENERAL', true),
    ('Foundation Day (test)',   'Does not take attendance yet.',       now() + interval '7 days', now() + interval '7 days 4 hours', 'GENERAL', false)
  RETURNING event_id, takes_attendance
)
INSERT INTO public.event_scanners (event_id, user_id, assigned_by)
SELECT event_id, '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'
FROM new_events
WHERE takes_attendance;
