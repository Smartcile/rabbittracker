ALTER TABLE "rabbit_tasks" ADD COLUMN "care_kind" text;--> statement-breakpoint
INSERT INTO "rabbit_tasks" ("rabbit_id", "label", "slot", "interval_days", "recurrence", "care_kind", "active")
SELECT cs."rabbit_id",
       COALESCE(l."label", cs."kind"),
       'anytime',
       cs."interval_days",
       jsonb_build_object(
         'kind', CASE WHEN cs."interval_days" <= 1 THEN 'daily' ELSE 'interval' END,
         'days', '[]'::jsonb,
         'count', 1,
         'intervalDays', GREATEST(cs."interval_days", 1)
       ),
       cs."kind",
       true
FROM "care_schedules" cs
LEFT JOIN "lookups" l ON l."kind" = 'care_type' AND l."value" = cs."kind";--> statement-breakpoint
INSERT INTO "rabbit_tasks" ("rabbit_id", "label", "slot", "interval_days", "recurrence", "care_kind", "active")
SELECT DISTINCT cr."rabbit_id",
       COALESCE(l."label", cr."kind"),
       'anytime',
       30,
       jsonb_build_object('kind', 'interval', 'days', '[]'::jsonb, 'count', 1, 'intervalDays', 30),
       cr."kind",
       true
FROM "care_records" cr
LEFT JOIN "lookups" l ON l."kind" = 'care_type' AND l."value" = cr."kind"
WHERE NOT EXISTS (
  SELECT 1 FROM "rabbit_tasks" t
  WHERE t."rabbit_id" = cr."rabbit_id" AND t."care_kind" = cr."kind"
);--> statement-breakpoint
INSERT INTO "task_completions" ("task_id", "completed_at", "notes")
SELECT t."id", (cr."done_at"::timestamp AT TIME ZONE 'UTC'), cr."notes"
FROM "care_records" cr
JOIN "rabbit_tasks" t ON t."rabbit_id" = cr."rabbit_id" AND t."care_kind" = cr."kind";--> statement-breakpoint
DROP TABLE "care_records" CASCADE;--> statement-breakpoint
DROP TABLE "care_schedules" CASCADE;
