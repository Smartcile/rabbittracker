CREATE TABLE "appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"title" text NOT NULL,
	"clinic" text DEFAULT '' NOT NULL,
	"vet" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"cost_cents" integer,
	"follow_up_at" timestamp with time zone,
	"event_uid" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"uid" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;