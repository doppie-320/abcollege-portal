-- The static pass is now the student's main pass, so events take it unless an
-- admin turns accepts_static_pass off to require the rotating code. Existing
-- events are switched on too, so the pass students now see first works at them.

ALTER TABLE "public"."events"
  ALTER COLUMN "accepts_static_pass" SET DEFAULT true;

UPDATE public.events SET accepts_static_pass = true WHERE NOT accepts_static_pass;
