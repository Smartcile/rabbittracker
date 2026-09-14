CREATE TABLE "rabbit_carers" (
	"rabbit_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rabbit_carers_rabbit_id_user_id_pk" PRIMARY KEY("rabbit_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_create_rabbits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_record_health" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_edit_rabbits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_view_costs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_manage_calendar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_edit_faq" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbit_carers" ADD CONSTRAINT "rabbit_carers_rabbit_id_rabbits_id_fk" FOREIGN KEY ("rabbit_id") REFERENCES "public"."rabbits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rabbit_carers" ADD CONSTRAINT "rabbit_carers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;