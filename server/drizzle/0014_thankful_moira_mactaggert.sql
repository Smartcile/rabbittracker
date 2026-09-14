CREATE TABLE "clinics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clinics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lookups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"default_int" integer,
	"default_cents" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lookups_kind_value_unique" UNIQUE("kind","value")
);
--> statement-breakpoint
ALTER TABLE "drug_batches" ADD COLUMN "supplier" text DEFAULT '' NOT NULL;