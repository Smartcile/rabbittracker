CREATE TABLE "rabbits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rabbits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"sex" text DEFAULT 'unknown' NOT NULL,
	"breed" text DEFAULT '' NOT NULL,
	"colour" text DEFAULT '' NOT NULL,
	"date_of_birth" date,
	"desexed" boolean DEFAULT false NOT NULL,
	"microchip" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"has_avatar" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
