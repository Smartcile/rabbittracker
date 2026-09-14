CREATE TABLE "care_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "care_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"kind" text NOT NULL,
	"done_at" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_schedules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "care_schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"kind" text NOT NULL,
	"interval_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_schedules_rabbit_kind_unique" UNIQUE("rabbit_id","kind")
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "treatments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"medication" text NOT NULL,
	"dose" text DEFAULT '' NOT NULL,
	"route" text DEFAULT '' NOT NULL,
	"frequency" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vaccinations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"vaccine" text NOT NULL,
	"given_at" date NOT NULL,
	"next_due_at" date,
	"vet" text DEFAULT '' NOT NULL,
	"batch" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_schedules" ADD CONSTRAINT "care_schedules_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;