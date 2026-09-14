CREATE TABLE "rabbit_bonds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rabbit_bonds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rabbit_bonds_pair_unique" UNIQUE("rabbit_id","partner_id")
);
--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "temperature_tenths_c" integer;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "pain_score" integer;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "quarantined" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "quarantine_until" date;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "target_weight_min_grams" integer;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "target_weight_max_grams" integer;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "feeding_plan" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "deceased_at" date;--> statement-breakpoint
ALTER TABLE "rabbits" ADD COLUMN "deceased_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbit_bonds" ADD CONSTRAINT "rabbit_bonds_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rabbit_bonds" ADD CONSTRAINT "rabbit_bonds_partner_id_rabbits_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;