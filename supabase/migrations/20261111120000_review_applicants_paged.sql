-- The account review page used to read every applicant in one request and
-- count them in the browser. PostgREST stops at max_rows (1000), so once there
-- were more applicants than that the page silently lost the rest: the counts
-- froze and newer pending applicants never showed up. These functions filter,
-- search, page and count in the database instead.
--
-- Both answer admins only. Anyone else gets no rows (or zero counts), the same
-- as applicant_birthdates. Admins themselves are never up for review.

-- One page of applicants, oldest submission first so the pending queue is
-- worked in order. total_count is how many rows match before paging.
CREATE OR REPLACE FUNCTION public.review_applicants(
  p_status public.user_status DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
  RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    email_address text,
    avatar_path text,
    birthdate date,
    student_id text,
    year_level text,
    program text,
    request_status public.user_status,
    reject_date timestamp with time zone,
    submitted_at timestamp with time zone,
    total_count bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with needle as (
    -- Escape LIKE wildcards so a search for "50%" or "a_b" is taken literally.
    select nullif(
      replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_'),
      ''
    ) as pattern
  ),
  matches as (
    select
      u.id,
      u.first_name,
      u.last_name,
      u.email_address,
      u.avatar_path,
      u.birthdate,
      s.student_id,
      y.name as year_level,
      c.short_name as program,
      r.request_status,
      r.reject_date,
      r.submitted_at
    from public.users u
    join public.students s on s.id = u.id
    join public.user_requests r on r.user_id = u.id
    left join public.yearlevels y on y.id = s.year_level
    left join public.courses c on c.id = s.course
    cross join needle n
    where (select public.is_admin())
      and not exists (select 1 from public.admins a where a.id = u.id)
      and (p_status is null or r.request_status = p_status)
      and (
        n.pattern is null
        or concat_ws(' ', u.first_name, u.last_name, u.email_address, s.student_id, c.short_name, y.name)
          ilike '%' || n.pattern || '%'
      )
  )
  select m.*, count(*) over () as total_count
  from matches m
  order by m.submitted_at asc nulls last, m.id
  limit least(greatest(coalesce(p_limit, 10), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.review_applicants(public.user_status, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_applicants(public.user_status, text, integer, integer) TO authenticated;

-- How many applicants are in each status, for the stat strip and filter chips.
CREATE OR REPLACE FUNCTION public.review_applicant_counts()
  RETURNS TABLE (
    pending bigint,
    accept bigint,
    reject bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    count(*) filter (where r.request_status = 'pending'),
    count(*) filter (where r.request_status = 'accept'),
    count(*) filter (where r.request_status = 'reject')
  from public.users u
  join public.students s on s.id = u.id
  join public.user_requests r on r.user_id = u.id
  where (select public.is_admin())
    and not exists (select 1 from public.admins a where a.id = u.id);
$function$;

REVOKE ALL ON FUNCTION public.review_applicant_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_applicant_counts() TO authenticated;
