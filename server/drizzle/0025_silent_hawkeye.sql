ALTER TABLE "bowl_readings" ADD COLUMN "slot" text;--> statement-breakpoint
ALTER TABLE "bowls" ADD COLUMN "slots" text[] DEFAULT '{}' NOT NULL;