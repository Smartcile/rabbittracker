CREATE TABLE "food_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "food_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"reorder_level_grams" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_stock_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "food_stock_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"bowl_reading_id" integer,
	"amount_grams" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bowls" ADD COLUMN "tare_grams" integer;--> statement-breakpoint
ALTER TABLE "bowls" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "food_stock_entries" ADD CONSTRAINT "food_stock_entries_product_id_food_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_stock_entries" ADD CONSTRAINT "food_stock_entries_bowl_reading_id_bowl_readings_id_fk" FOREIGN KEY ("bowl_reading_id") REFERENCES "public"."bowl_readings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bowls" ADD CONSTRAINT "bowls_product_id_food_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE set null ON UPDATE no action;