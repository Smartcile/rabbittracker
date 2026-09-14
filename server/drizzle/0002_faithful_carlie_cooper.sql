CREATE TABLE "health_checks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "health_checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rabbit_id" integer NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"weight_grams" integer,
	"appetite" text,
	"droppings" text,
	"energy" text,
	"body_condition" integer,
	"notes" text DEFAULT '' NOT NULL,
	"has_photo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;