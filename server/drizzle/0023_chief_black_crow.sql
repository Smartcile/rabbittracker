ALTER TABLE "medication_logs" ADD COLUMN "slot" text;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "slots" text[] DEFAULT '{}' NOT NULL;