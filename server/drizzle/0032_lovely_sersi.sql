ALTER TABLE "bowls" ADD COLUMN "product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rabbit_tasks" ADD COLUMN "products" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "products" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "bowls" SET "product_ids" = jsonb_build_array("product_id") WHERE "product_id" IS NOT NULL;--> statement-breakpoint
UPDATE "rabbit_tasks" SET "products" = jsonb_build_array(jsonb_build_object('productId', "product_id", 'amountGrams', "amount_grams")) WHERE "product_id" IS NOT NULL;--> statement-breakpoint
UPDATE "task_templates" SET "products" = jsonb_build_array(jsonb_build_object('productId', "product_id", 'amountGrams', "amount_grams")) WHERE "product_id" IS NOT NULL;
