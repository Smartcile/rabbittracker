CREATE TABLE "task_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"slot" text DEFAULT 'anytime' NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"product_id" integer,
	"amount_grams" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_stock_entries" ADD COLUMN "task_completion_id" integer;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD COLUMN "template_id" integer;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD COLUMN "amount_grams" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_product_id_food_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_stock_entries" ADD CONSTRAINT "food_stock_entries_task_completion_id_task_completions_id_fk" FOREIGN KEY ("task_completion_id") REFERENCES "public"."task_completions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD CONSTRAINT "rabbit_tasks_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD CONSTRAINT "rabbit_tasks_product_id_food_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE set null ON UPDATE no action;