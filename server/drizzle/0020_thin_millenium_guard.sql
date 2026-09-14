CREATE TABLE "bowl_readings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bowl_readings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bowl_id" integer NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"kind" text DEFAULT 'weigh' NOT NULL,
	"weight_grams" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bowls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bowls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bowl_readings" ADD CONSTRAINT "bowl_readings_bowl_id_bowls_id_fk" FOREIGN KEY ("bowl_id") REFERENCES "public"."bowls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bowls" ADD CONSTRAINT "bowls_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;