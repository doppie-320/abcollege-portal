-- Run with: npx supabase test db
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- Fixtures --------------------------------------------------------------------
-- The on_user_register trigger adds the users and a pending user_requests row.
-- Searches are scoped to 'pgtap-review' so other test or seed data can't match.

INSERT INTO public.courses (id, name, short_name) VALUES (9301, 'Review Course', 'RVC');
INSERT INTO public.yearlevels (id, name) VALUES (9301, 'Review Year');

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'admin@pgtap-review.local',    '{"first_name":"Ada","last_name":"Admin"}'),
  ('f0000000-0000-0000-0000-000000000002', 'student@pgtap-review.local',  '{"first_name":"Stu","last_name":"Dent"}');

INSERT INTO public.admins (id) VALUES ('f0000000-0000-0000-0000-000000000001');
INSERT INTO private.mfa_sessions (session_id, user_id)
VALUES ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001');

-- The admin also has student details, to show admins are never listed.
INSERT INTO public.students (id, student_id, year_level, course) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'PGTAPREV0', 9301, 9301),
  ('f0000000-0000-0000-0000-000000000002', 'PGTAPREV1', 9301, 9301);

CREATE FUNCTION pg_temp.login(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'session_id', uid)::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Counts before the applicants below, so the test doesn't depend on seed data.
-- The JWT claims outlive RESET role, so this still asks as the admin.
SELECT pg_temp.login('f0000000-0000-0000-0000-000000000001');
RESET role;
CREATE TEMP TABLE counts_before AS SELECT * FROM public.review_applicant_counts();
GRANT SELECT ON counts_before TO authenticated;

-- 25 applicants: 15 pending, 6 accepted, 4 rejected, submitted a minute apart.
-- Applicant 7 has wildcard characters in their name.
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT
  ('f1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'applicant' || n || '@pgtap-review.local',
  json_build_object(
    'first_name', CASE WHEN n = 7 THEN '50%_off' ELSE 'Applicant' || n END,
    'last_name', 'Reviewee'
  )
FROM generate_series(1, 25) AS n;

INSERT INTO public.students (id, student_id, year_level, course)
SELECT ('f1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'PGTAPREV-' || n, 9301, 9301
FROM generate_series(1, 25) AS n;

UPDATE public.user_requests r
SET
  submitted_at = timestamptz '2020-01-01' + (n || ' minutes')::interval,
  request_status = (CASE WHEN n <= 15 THEN 'pending' WHEN n <= 21 THEN 'accept' ELSE 'reject' END)::public.user_status
FROM generate_series(1, 25) AS n
WHERE r.user_id = ('f1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;

-- Tests -----------------------------------------------------------------------

SELECT pg_temp.login('f0000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM public.review_applicants(NULL, 'pgtap-review', 100, 0)),
  26,
  'admins see every applicant but not other admins'
);

SELECT is(
  (SELECT count(*)::int FROM public.review_applicants(NULL, 'pgtap-review', 10, 0)),
  10,
  'one page holds p_limit rows'
);

SELECT is(
  (SELECT DISTINCT total_count::int FROM public.review_applicants(NULL, 'pgtap-review', 10, 0)),
  26,
  'total_count counts every match, not just the page'
);

SELECT is(
  (SELECT array_agg(email_address) FROM public.review_applicants('pending', 'applicant', 5, 10)),
  ARRAY[
    'applicant11@pgtap-review.local',
    'applicant12@pgtap-review.local',
    'applicant13@pgtap-review.local',
    'applicant14@pgtap-review.local',
    'applicant15@pgtap-review.local'
  ],
  'pages are ordered oldest submission first'
);

SELECT is(
  (SELECT count(*)::int FROM public.review_applicants(NULL, 'pgtap-review', 10, 30)),
  0,
  'a page past the end is empty'
);

SELECT is(
  (SELECT DISTINCT total_count::int FROM public.review_applicants('accept', 'pgtap-review', 10, 0)),
  6,
  'filters by status'
);

SELECT is(
  (SELECT array_agg(student_id) FROM public.review_applicants(NULL, '  pgtaprev-2 ', 10, 0)),
  ARRAY['PGTAPREV-2', 'PGTAPREV-20', 'PGTAPREV-21', 'PGTAPREV-22', 'PGTAPREV-23', 'PGTAPREV-24', 'PGTAPREV-25'],
  'search matches student IDs, ignoring case and surrounding spaces'
);

SELECT is(
  (SELECT count(*)::int FROM public.review_applicants(NULL, 'applicant3 reviewee', 10, 0)),
  1,
  'search matches across first and last name'
);

SELECT is(
  (SELECT array_agg(first_name) FROM public.review_applicants(NULL, '%_', 10, 0)),
  ARRAY['50%_off'],
  'search treats % and _ literally'
);

SELECT is(
  (SELECT row(program, year_level)::text FROM public.review_applicants(NULL, 'applicant1@', 10, 0)),
  '(RVC,"Review Year")',
  'rows carry the course abbreviation and year level'
);

SELECT is(
  (SELECT row(c.pending - b.pending, c.accept - b.accept, c.reject - b.reject)::text
   FROM public.review_applicant_counts() c, counts_before b),
  '(15,6,4)',
  'counts every status, without a row cap'
);

-- Non-admins ------------------------------------------------------------------

SELECT pg_temp.login('f0000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.review_applicants(NULL, NULL, 100, 0)),
  0,
  'non-admins see no applicants'
);

SELECT is(
  (SELECT row(pending, accept, reject)::text FROM public.review_applicant_counts()),
  '(0,0,0)',
  'non-admins see zero counts'
);

RESET role;
SET role anon;

SELECT throws_ok(
  'SELECT * FROM public.review_applicants()',
  '42501',
  NULL,
  'signed-out visitors cannot call it'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
