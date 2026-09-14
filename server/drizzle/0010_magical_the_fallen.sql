ALTER TABLE "rabbits" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "demo_mode" boolean DEFAULT false NOT NULL;