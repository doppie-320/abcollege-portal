-- courses.name is the longhand and short_name the abbreviation. Courses are
-- matched by id because dev and prod spell some of the old names differently.
ALTER TABLE public.courses
  ADD COLUMN short_name text,
  ADD COLUMN is_selectable boolean NOT NULL DEFAULT true;

UPDATE public.courses AS c
SET name = v.name, short_name = v.short_name
FROM (VALUES
  (1, 'Bachelor of Science in Civil Engineering - Construction Engineering Management', 'BSCE-CEM'),
  (2, 'Bachelor of Science in Civil Engineering - Structural Engineering', 'BSCE-SE'),
  (3, 'Bachelor of Science in Electrical Engineering', 'BSEE'),
  (4, 'Bachelor of Science in Geodetic Engineering', 'BSGE'),
  (5, 'Bachelor of Science in Computer Engineering', 'BSCPE'),
  (6, 'Bachelor of Science in Electronics and Communications Engineering', 'BSECE'),
  (7, 'Bachelor of Science in Mechanical Engineering', 'BSME')
) AS v (id, name, short_name)
WHERE c.id = v.id;

ALTER TABLE public.courses
  ALTER COLUMN short_name SET NOT NULL;

ALTER TABLE public.yearlevels
  ADD COLUMN is_selectable boolean NOT NULL DEFAULT true;

-- The existing rows were added with explicit ids, which left these sequences
-- behind them, so the next generated id would collide.
SELECT setval(pg_get_serial_sequence('public.courses', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL)
FROM public.courses;

SELECT setval(pg_get_serial_sequence('public.yearlevels', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL)
FROM public.yearlevels;

-- Rows with is_selectable = false stay readable, because profiles and rosters
-- still show them, but sign-up doesn't offer them. Their ids differ per project,
-- so look them up by name.
INSERT INTO public.courses (name, short_name, is_selectable)
VALUES ('DEVELOPER', 'DEVELOPER', false);

INSERT INTO public.yearlevels (name, is_selectable)
VALUES ('DEVELOPER', false);
