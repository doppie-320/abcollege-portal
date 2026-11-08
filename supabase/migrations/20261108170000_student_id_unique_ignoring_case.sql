-- Student IDs are saved in capitals now, but the primary key only stops exact
-- duplicates, so an older lowercase ID could be registered again in capitals by
-- another account. Sign-up checks this ignoring case too (app/signup/actions.ts);
-- this index makes the database enforce it. find_student_by_school_id already
-- looks IDs up by upper(student_id), so it can use the index as well.
--
-- If existing rows already differ only by case, the index can't be built. Those
-- are left alone, since someone has to decide whose ID it is, and the migration
-- warns instead. Create the index by hand once they're sorted out:
--   CREATE UNIQUE INDEX students_student_id_upper_key ON public.students (upper(student_id));
DO $$
DECLARE
  duplicates integer;
BEGIN
  SELECT count(*) INTO duplicates
  FROM (
    SELECT 1 FROM public.students GROUP BY upper(student_id) HAVING count(*) > 1
  ) d;

  IF duplicates > 0 THEN
    RAISE WARNING '% student IDs are used by more than one account ignoring case; students_student_id_upper_key was not created', duplicates;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS students_student_id_upper_key
      ON public.students (upper(student_id));
  END IF;
END $$;
