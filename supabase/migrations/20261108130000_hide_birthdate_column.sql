-- public.users is readable by anyone holding the public API key (its SELECT
-- policy is USING (true)), which included full birthdates with the year. Members
-- only agreed to their birthday showing on the calendar, and birthday_celebrants
-- already returns just the day, so block direct reads of the column.
--
-- Postgres can't take one column out of a table-wide SELECT grant, so replace it
-- with a grant on every other column. They're looked up rather than listed
-- because the hosted table has been changed by hand before.
--
-- A column added to users later is NOT readable until it gets its own grant:
--   GRANT SELECT (new_column) ON public.users TO anon, authenticated;
REVOKE SELECT ON TABLE public.users FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  readable_columns text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO readable_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name <> 'birthdate';

  EXECUTE format('GRANT SELECT (%s) ON TABLE public.users TO anon, authenticated', readable_columns);
END $$;

-- The account review page shows admins each applicant's full birthday. Anyone
-- else gets no rows.
CREATE OR REPLACE FUNCTION public.applicant_birthdates()
  RETURNS TABLE (
    id uuid,
    birthdate date
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select u.id, u.birthdate
  from public.users u
  where u.birthdate is not null
    and public.is_admin();
$function$;

REVOKE ALL ON FUNCTION public.applicant_birthdates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applicant_birthdates() TO authenticated;
