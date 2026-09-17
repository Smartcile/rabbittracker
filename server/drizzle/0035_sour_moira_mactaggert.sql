ALTER TABLE "checklists" ADD COLUMN "recurrence" jsonb DEFAULT '{"kind":"daily","days":[],"count":1,"intervalDays":1}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "checklists" SET "recurrence" = '{"kind":"weekdays","days":["sun"],"count":1,"intervalDays":1}'::jsonb WHERE "key" = 'weekly';
