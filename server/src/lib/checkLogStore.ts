import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { checklistItems, checklists, checkLogTypes } from "../db/schema.ts";
import type { CheckLogTypeRow } from "../db/schema.ts";
import { DAILY_CHECKLIST_KEY } from "./checklistStore.ts";

export async function listAllCheckLogTypes(): Promise<CheckLogTypeRow[]> {
  return db.select().from(checkLogTypes).orderBy(asc(checkLogTypes.sortOrder), asc(checkLogTypes.id));
}

export async function listCheckLogTypes(): Promise<CheckLogTypeRow[]> {
  return listAllCheckLogTypes();
}

export async function listDailyCheckLogTypes(): Promise<CheckLogTypeRow[]> {
  const [checklist] = await db
    .select()
    .from(checklists)
    .where(eq(checklists.key, DAILY_CHECKLIST_KEY))
    .limit(1);
  if (!checklist) return listAllCheckLogTypes();
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklist.id))
    .orderBy(asc(checklistItems.sortOrder), asc(checklistItems.id));
  const typeIds = items
    .filter((item) => item.typeId !== null)
    .map((item) => item.typeId as number);
  if (typeIds.length === 0) return [];
  const rows = await db.select().from(checkLogTypes).where(inArray(checkLogTypes.id, typeIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return typeIds
    .map((id) => byId.get(id))
    .filter((row): row is CheckLogTypeRow => row !== undefined);
}
