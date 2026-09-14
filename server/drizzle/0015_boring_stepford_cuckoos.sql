ALTER TABLE "vets" ADD COLUMN "clinic_id" integer;--> statement-breakpoint
INSERT INTO "clinics" ("name") SELECT DISTINCT "clinic" FROM "vets" WHERE "clinic" <> '' ORDER BY "clinic";--> statement-breakpoint
UPDATE "vets" SET "clinic_id" = (SELECT "id" FROM "clinics" WHERE "clinics"."name" = "vets"."clinic") WHERE "clinic" <> '';--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "clinic";--> statement-breakpoint
ALTER TABLE "vets" ADD CONSTRAINT "vets_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;