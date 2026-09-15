import { count, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { checklistItems, checkLogTypes } from "../db/schema.ts";
import { DAILY_CHECKLIST_KEY, ensureDefaultChecklists, getChecklistByKey } from "./checklistStore.ts";

const DEFAULT_CHECK_LOG_TYPES = [
  {
    key: "poo",
    label: "Poo",
    unit: "",
    hasNumber: false,
    hasText: false,
    multiple: false,
    options: ["Normal", "Soft", "Runny", "None"],
  },
  {
    key: "behaviour",
    label: "Behaviour",
    unit: "",
    hasNumber: false,
    hasText: false,
    multiple: true,
    options: [
      "Binkies",
      "Exploring",
      "Flopped",
      "Comfortable",
      "Uncomfortable",
      "Hiding",
      "Quiet",
      "Active",
    ],
  },
];

export async function ensureCheckLogSeed(): Promise<void> {
  await ensureDefaultChecklists();
  const [{ value }] = await db.select({ value: count() }).from(checkLogTypes);
  if (value > 0) return;
  const daily = await getChecklistByKey(DAILY_CHECKLIST_KEY);
  const rows = await db
    .insert(checkLogTypes)
    .values(DEFAULT_CHECK_LOG_TYPES.map((type, index) => ({ ...type, sortOrder: index })))
    .returning({ id: checkLogTypes.id });
  if (daily) {
    await db.insert(checklistItems).values(
      rows.map((row, index) => ({ checklistId: daily.id, typeId: row.id, sortOrder: index })),
    );
  }
}

export async function addMissingDefaultCheckLogTypes(): Promise<string[]> {
  await ensureDefaultChecklists();
  const rows = await db.select().from(checkLogTypes);
  const existing = new Set(rows.map((row) => row.key));
  const missing = DEFAULT_CHECK_LOG_TYPES.filter((type) => !existing.has(type.key));
  if (missing.length === 0) return [];
  const highest = rows.reduce((value, row) => Math.max(value, row.sortOrder), -1);
  const inserted = await db
    .insert(checkLogTypes)
    .values(missing.map((type, index) => ({ ...type, sortOrder: highest + 1 + index })))
    .returning({ id: checkLogTypes.id });
  const daily = await getChecklistByKey(DAILY_CHECKLIST_KEY);
  if (daily) {
    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, daily.id));
    const maxOrder = items.reduce((value, item) => Math.max(value, item.sortOrder), -1);
    await db.insert(checklistItems).values(
      inserted.map((row, index) => ({
        checklistId: daily.id,
        typeId: row.id,
        sortOrder: maxOrder + 1 + index,
      })),
    );
  }
  return missing.map((type) => type.label);
}
