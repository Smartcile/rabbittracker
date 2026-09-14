CREATE TABLE "drug_batches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drug_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"drug_id" integer NOT NULL,
	"quantity_milli_units" integer DEFAULT 0 NOT NULL,
	"expiry_date" date,
	"batch" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drugs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"active_ingredient" text DEFAULT '' NOT NULL,
	"form" text DEFAULT 'liquid' NOT NULL,
	"unit" text DEFAULT 'ml' NOT NULL,
	"concentration_micrograms_per_unit" integer,
	"dose_micrograms_per_kg" integer,
	"doses_per_day" integer DEFAULT 1 NOT NULL,
	"route" text DEFAULT '' NOT NULL,
	"frequency" text DEFAULT '' NOT NULL,
	"duration_days" integer,
	"how_to_use" text DEFAULT '' NOT NULL,
	"warnings" text DEFAULT '' NOT NULL,
	"reorder_level_milli_units" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "drug_id" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "dose_milli_units" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "stock_deducted_milli_units" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drug_batches" ADD CONSTRAINT "drug_batches_drug_id_drugs_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_drug_id_drugs_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("id") ON DELETE set null ON UPDATE no action;