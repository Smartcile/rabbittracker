CREATE TABLE "check_log_photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_log_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"log_id" integer NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_log_types" ADD COLUMN "multiple" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "check_logs" ADD COLUMN "value_labels" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "check_log_photos" ADD CONSTRAINT "check_log_photos_log_id_check_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."check_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "check_logs" SET "value_labels" = ARRAY["value_text"], "value_text" = '' WHERE "value_text" <> '' AND "type_id" IN (SELECT "id" FROM "check_log_types" WHERE cardinality("options") > 0);