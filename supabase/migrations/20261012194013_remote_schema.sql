ALTER TABLE "public"."events"
  DROP COLUMN "event_date";

CREATE TABLE "public"."attendance" (
  "event_id" bigint NOT NULL,
  "user_id"  bigint NOT NULL,
  "status"   text   NOT NULL,
  CONSTRAINT "attendance_pkey" PRIMARY KEY (event_id, user_id)
);

ALTER TABLE "public"."attendance"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."events"
  ADD COLUMN "event_start" timestamp WITH time zone NOT NULL;

ALTER TABLE "public"."events"
  ADD COLUMN "event_end" timestamp WITH time zone NOT NULL;

ALTER TABLE "public"."events"
  ADD COLUMN "tag" text NOT NULL;

ALTER TABLE "public"."events"
  ALTER COLUMN "event_description" DROP NOT NULL;

ALTER TABLE "public"."events"
  ALTER COLUMN "event_description" DROP DEFAULT;

ALTER TABLE "public"."events"
  ALTER COLUMN "event_description" TYPE text USING "event_description"::text;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."attendance" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance" TO "service_role";

