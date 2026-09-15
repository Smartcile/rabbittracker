CREATE TABLE "checklist_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklist_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"checklist_id" integer NOT NULL,
	"section_id" integer,
	"type_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "checklist_items_checklist_section_unique" UNIQUE("checklist_id","section_id"),
	CONSTRAINT "checklist_items_checklist_type_unique" UNIQUE("checklist_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"is_daily" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklists_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "checklist_sections" ADD COLUMN "unit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_sections" ADD COLUMN "has_number" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_sections" ADD COLUMN "has_text" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_section_id_checklist_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."checklist_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_type_id_check_log_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."check_log_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "checklists" ("key", "label", "is_daily", "sort_order") VALUES
	('weekly', 'Weekly checklist', false, 0),
	('daily', 'Daily checks', true, 1);--> statement-breakpoint
INSERT INTO "checklist_items" ("checklist_id", "section_id", "sort_order")
SELECT c."id", s."id", s."sort_order"
FROM "checklist_sections" s, "checklists" c
WHERE c."key" = 'weekly';--> statement-breakpoint
INSERT INTO "checklist_items" ("checklist_id", "type_id", "sort_order")
SELECT c."id", t."id", t."sort_order"
FROM "check_log_types" t, "checklists" c
WHERE c."key" = 'daily';