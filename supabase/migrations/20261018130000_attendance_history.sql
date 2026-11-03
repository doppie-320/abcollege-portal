-- Attendance history: every time a student's record for an event is created,
-- re-recorded, changed or removed, a row lands in attendance_history.
--
-- public.attendance only keeps the latest state, so overrides (rejected ->
-- present, present -> rejected, admin corrections) used to erase what came
-- before. A trigger writes the history rather than the app, so scans, manual
-- check-ins, admin edits and deletes are all covered and nothing can skip it.
-- Clients can only read it.

CREATE TYPE "public"."attendance_action" AS ENUM (
  'recorded', -- a record was saved; previous_status is set when it replaced one with the same status
  'changed',  -- the status flipped; previous_status is what it was
  'removed'   -- an admin deleted the record; previous_status is what it was
);

CREATE TABLE "public"."attendance_history" (
  "id"              bigint                    GENERATED ALWAYS AS IDENTITY,
  "event_id"        bigint                    NOT NULL,
  "user_id"         uuid                      NOT NULL,
  "action"          public.attendance_action  NOT NULL,
  -- The status after this entry; null when the record was removed.
  "status"          public.attendance_status,
  "previous_status" public.attendance_status,
  -- How the record was saved; null for removals.
  "method"          public.attendance_method,
  -- Who did it: the scanner or admin who recorded it, or the admin who removed it.
  "actor"           uuid,
  "note"            text,
  "happened_at"     timestamp with time zone  NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_history_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE CASCADE,
  CONSTRAINT "attendance_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT "attendance_history_actor_fkey" FOREIGN KEY (actor) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX "attendance_history_event_user_idx" ON "public"."attendance_history" (event_id, user_id, happened_at);
CREATE INDEX "attendance_history_user_id_idx" ON "public"."attendance_history" (user_id);

ALTER TABLE "public"."attendance_history"
  ENABLE ROW LEVEL SECURITY;

-- Same readers as public.attendance: the student, admins, and the event's scanners.
CREATE POLICY "Own, scanned or admin attendance history is readable" ON "public"."attendance_history"
  FOR SELECT
  TO "authenticated"
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.event_scanners es
      WHERE es.event_id = attendance_history.event_id AND es.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE "public"."attendance_history" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."attendance_history" TO "authenticated";

-- Trigger ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.log_attendance_change ()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.attendance_history (event_id, user_id, action, status, method, actor, note, happened_at)
    values (new.event_id, new.user_id, 'recorded', new.status, new.method, new.recorded_by, new.note, new.recorded_at);

  elsif tg_op = 'UPDATE' then
    insert into public.attendance_history (event_id, user_id, action, status, previous_status, method, actor, note, happened_at)
    values (
      new.event_id,
      new.user_id,
      case when new.status <> old.status then 'changed' else 'recorded' end::public.attendance_action,
      new.status,
      old.status,
      new.method,
      new.recorded_by,
      new.note,
      new.recorded_at
    );

  -- Skipped when the student's account is being deleted: their history goes
  -- with it, and inserting a row for a deleted user would fail.
  elsif exists (select 1 from public.users where id = old.user_id) then
    insert into public.attendance_history (event_id, user_id, action, previous_status, actor)
    values (old.event_id, old.user_id, 'removed', old.status, auth.uid());
  end if;

  return null;
end;
$function$;

REVOKE ALL ON FUNCTION private.log_attendance_change() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "attendance_history_log"
  AFTER INSERT OR UPDATE OR DELETE ON "public"."attendance"
  FOR EACH ROW
  EXECUTE FUNCTION private.log_attendance_change();

-- Records saved before this migration only have their latest state; start
-- their history from that.
INSERT INTO public.attendance_history (event_id, user_id, action, status, method, actor, note, happened_at)
SELECT event_id, user_id, 'recorded', status, method, recorded_by, note, recorded_at
FROM public.attendance;

-- Reporting -------------------------------------------------------------------

-- History with the actor's name, for the admin roster. Runs with the caller's
-- permissions, so the policy above still applies.
CREATE OR REPLACE VIEW "public"."attendance_history_report"
  WITH (security_invoker = true)
  AS
  SELECT
    h.id,
    h.event_id,
    h.user_id,
    h.action,
    h.status,
    h.previous_status,
    h.method,
    nullif(trim(concat_ws(' ', r.first_name, r.last_name)), '') AS actor,
    h.note,
    h.happened_at
  FROM public.attendance_history h
  LEFT JOIN public.users r ON r.id = h.actor;

REVOKE ALL ON TABLE "public"."attendance_history_report" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."attendance_history_report" TO "authenticated";
