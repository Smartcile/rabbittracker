CREATE TABLE "breed_norms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "breed_norms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"breed" text NOT NULL,
	"min_grams" integer NOT NULL,
	"max_grams" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "breed_norms_breed_unique" UNIQUE("breed")
);
--> statement-breakpoint
CREATE TABLE "growth_stages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_stages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"guidance" text DEFAULT '' NOT NULL,
	"start_days" integer DEFAULT 0 NOT NULL,
	"end_days" integer NOT NULL,
	"sex" text DEFAULT 'any' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rabbit_stage_completions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rabbit_stage_completions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"completed_at" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rabbit_stage_completions_unique" UNIQUE("rabbit_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "bowls" ADD COLUMN "kind" text DEFAULT 'food' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "food_min_grams_per_kg" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "food_max_grams_per_kg" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "water_min_milli_litres_per_kg" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "water_max_milli_litres_per_kg" integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbit_stage_completions" ADD CONSTRAINT "rabbit_stage_completions_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rabbit_stage_completions" ADD CONSTRAINT "rabbit_stage_completions_stage_id_growth_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."growth_stages"("id") ON DELETE cascade ON UPDATE no action;