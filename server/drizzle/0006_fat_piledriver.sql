CREATE TABLE "calendar_subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"url" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "feed_token" text DEFAULT '' NOT NULL;
--> statement-breakpoint
INSERT INTO "calendar_subscriptions" ("label", "url", "last_sync_at", "sync_error")
SELECT "calendar_label", "calendar_url", "last_sync_at", "sync_error" FROM "settings" WHERE "calendar_url" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "subscription_id" integer;
--> statement-breakpoint
UPDATE "calendar_events" SET "subscription_id" = (SELECT "id" FROM "calendar_subscriptions" ORDER BY "id" LIMIT 1) WHERE "subscription_id" IS NULL;
--> statement-breakpoint
DELETE FROM "calendar_events" WHERE "subscription_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "subscription_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_uid_unique";
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_subscription_id_calendar_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."calendar_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_subscription_uid_unique" UNIQUE("subscription_id","uid");
