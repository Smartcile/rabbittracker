import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  checklistItems,
  checklistOptions,
  checklistPhotos,
  checklists,
  checklistSections,
  checkLogTypes,
} from "../db/schema.ts";
import type { ChecklistRow, ChecklistSectionRow } from "../db/schema.ts";
import { slugifyLabel } from "../../../shared/checklist.ts";
import type { ChecklistSectionConfig } from "../../../shared/checklist.ts";
import type { ChecklistSectionDto } from "../../../shared/types.ts";
import { HttpError } from "./http.ts";

export const WEEKLY_CHECKLIST_KEY = "weekly";
export const DAILY_CHECKLIST_KEY = "daily";

export async function listChecklists(): Promise<ChecklistRow[]> {
  return db.select().from(checklists).orderBy(asc(checklists.sortOrder), asc(checklists.id));
}

export async function findChecklist(id: number): Promise<ChecklistRow> {
  const rows = await db.select().from(checklists).where(eq(checklists.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Checklist not found");
  return rows[0];
}

export async function getChecklistByKey(key: string): Promise<ChecklistRow | null> {
  const rows = await db.select().from(checklists).where(eq(checklists.key, key)).limit(1);
  return rows[0] ?? null;
}

export async function ensureDefaultChecklists(): Promise<void> {
  await db
    .insert(checklists)
    .values([
      { key: WEEKLY_CHECKLIST_KEY, label: "Weekly checklist", isDaily: false, sortOrder: 0 },
      { key: DAILY_CHECKLIST_KEY, label: "Daily checks", isDaily: true, sortOrder: 1 },
    ])
    .onConflictDoNothing({ target: checklists.key });
}

export async function uniqueChecklistKey(label: string): Promise<string> {
  const rows = await db.select({ key: checklists.key }).from(checklists);
  return uniqueSlug(
    slugifyLabel(label),
    new Set(rows.map((row) => row.key)),
  );
}

export async function listChecklistItems(checklistId: number) {
  return db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))
    .orderBy(asc(checklistItems.sortOrder), asc(checklistItems.id));
}

export async function listAllChecklistSections(): Promise<ChecklistSectionDto[]> {
  const [sections, options, photos] = await Promise.all([
    db
      .select()
      .from(checklistSections)
      .orderBy(asc(checklistSections.sortOrder), asc(checklistSections.id)),
    db.select().from(checklistOptions).orderBy(asc(checklistOptions.sortOrder), asc(checklistOptions.id)),
    db.select().from(checklistPhotos).orderBy(asc(checklistPhotos.sortOrder), asc(checklistPhotos.id)),
  ]);
  return sections.map((section) => sectionDto(section, options, photos));
}

async function sectionsForChecklists(checklistIds: number[]): Promise<ChecklistSectionDto[]> {
  if (checklistIds.length === 0) return [];
  const items = await db
    .select()
    .from(checklistItems)
    .where(inArray(checklistItems.checklistId, checklistIds));
  const sectionIds = new Set(
    items.filter((item) => item.sectionId !== null).map((item) => item.sectionId as number),
  );
  if (sectionIds.size === 0) return [];
  const all = await listAllChecklistSections();
  return all.filter((section) => sectionIds.has(section.id));
}

export async function typeKeysForChecklists(checklistIds: number[]): Promise<string[]> {
  if (checklistIds.length === 0) return [];
  const items = await db
    .select()
    .from(checklistItems)
    .where(inArray(checklistItems.checklistId, checklistIds));
  const typeIds = [
    ...new Set(items.filter((item) => item.typeId !== null).map((item) => item.typeId as number)),
  ];
  if (typeIds.length === 0) return [];
  const rows = await db
    .select({ key: checkLogTypes.key })
    .from(checkLogTypes)
    .where(inArray(checkLogTypes.id, typeIds));
  return rows.map((row) => row.key);
}

async function nonDailyChecklistIds(): Promise<number[]> {
  const rows = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(eq(checklists.isDaily, false));
  return rows.map((row) => row.id);
}

export async function listChecklistConfig(): Promise<ChecklistSectionDto[]> {
  return sectionsForChecklists(await nonDailyChecklistIds());
}

export async function listChecklistTypeKeys(): Promise<string[]> {
  return typeKeysForChecklists(await nonDailyChecklistIds());
}

export async function listChecklistSections(): Promise<ChecklistSectionConfig[]> {
  const config = await listChecklistConfig();
  return config.map((section) => ({
    key: section.key,
    label: section.label,
    hint: section.hint,
    multiple: section.multiple,
    unit: section.unit,
    hasNumber: section.hasNumber,
    hasText: section.hasText,
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

function sectionDto(
  section: ChecklistSectionRow,
  options: (typeof checklistOptions.$inferSelect)[],
  photos: (typeof checklistPhotos.$inferSelect)[],
): ChecklistSectionDto {
  return {
    id: section.id,
    key: section.key,
    label: section.label,
    hint: section.hint,
    multiple: section.multiple,
    unit: section.unit,
    hasNumber: section.hasNumber,
    hasText: section.hasText,
    options: options
      .filter((option) => option.sectionId === section.id)
      .map((option) => ({ id: option.id, value: option.value, label: option.label })),
    photos: photos
      .filter((photo) => photo.sectionId === section.id)
      .map((photo) => ({ id: photo.id, caption: photo.caption })),
  };
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
