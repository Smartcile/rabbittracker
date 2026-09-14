import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { checklistOptions, checklistPhotos, checklistSections } from "../db/schema.ts";
import type { ChecklistSectionRow } from "../db/schema.ts";
import { slugifyLabel } from "../../../shared/checklist.ts";
import type { ChecklistSectionConfig } from "../../../shared/checklist.ts";
import type { ChecklistSectionDto } from "../../../shared/types.ts";
import { HttpError } from "./http.ts";

export async function listChecklistConfig(): Promise<ChecklistSectionDto[]> {
  const [sections, options, photos] = await Promise.all([
    db
      .select()
      .from(checklistSections)
      .orderBy(asc(checklistSections.sortOrder), asc(checklistSections.id)),
    db.select().from(checklistOptions).orderBy(asc(checklistOptions.sortOrder), asc(checklistOptions.id)),
    db.select().from(checklistPhotos).orderBy(asc(checklistPhotos.sortOrder), asc(checklistPhotos.id)),
  ]);
  return sections.map((section) => ({
    id: section.id,
    key: section.key,
    label: section.label,
    hint: section.hint,
    multiple: section.multiple,
    options: options
      .filter((option) => option.sectionId === section.id)
      .map((option) => ({ id: option.id, value: option.value, label: option.label })),
    photos: photos
      .filter((photo) => photo.sectionId === section.id)
      .map((photo) => ({ id: photo.id, caption: photo.caption })),
  }));
}

export async function listChecklistSections(): Promise<ChecklistSectionConfig[]> {
  const config = await listChecklistConfig();
  return config.map((section) => ({
    key: section.key,
    label: section.label,
    hint: section.hint,
    multiple: section.multiple,
    options: section.options.map((option) => ({ value: option.value, label: option.label })),
  }));
}

export async function findSection(id: number): Promise<ChecklistSectionRow> {
  const rows = await db.select().from(checklistSections).where(eq(checklistSections.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Checklist section not found");
  return rows[0];
}

export async function uniqueSectionKey(label: string): Promise<string> {
  const rows = await db.select({ key: checklistSections.key }).from(checklistSections);
  return uniqueSlug(
    slugifyLabel(label),
    new Set(rows.map((row) => row.key)),
  );
}

export async function uniqueOptionValue(sectionId: number, label: string): Promise<string> {
  const rows = await db
    .select({ value: checklistOptions.value })
    .from(checklistOptions)
    .where(eq(checklistOptions.sectionId, sectionId));
  return uniqueSlug(
    slugifyLabel(label),
    new Set(rows.map((row) => row.value)),
  );
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
