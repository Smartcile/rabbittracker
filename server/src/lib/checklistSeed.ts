import { count } from "drizzle-orm";
import { DEFAULT_CHECKLIST_SECTIONS } from "../../../shared/checklist.ts";
import { db } from "../db/index.ts";
import { checklistItems, checklistOptions, checklistSections } from "../db/schema.ts";
import { ensureDefaultChecklists, getChecklistByKey, WEEKLY_CHECKLIST_KEY } from "./checklistStore.ts";

export async function ensureChecklistSeed(): Promise<void> {
  await ensureDefaultChecklists();
  const [{ value }] = await db.select({ value: count() }).from(checklistSections);
  if (value > 0) return;
  const weekly = await getChecklistByKey(WEEKLY_CHECKLIST_KEY);
  for (const [index, section] of DEFAULT_CHECKLIST_SECTIONS.entries()) {
    const [row] = await db
      .insert(checklistSections)
      .values({
        key: section.key,
        label: section.label,
        hint: section.hint,
        multiple: section.multiple,
        sortOrder: index,
      })
      .returning({ id: checklistSections.id });
    if (section.options.length > 0) {
      await db.insert(checklistOptions).values(
        section.options.map((option, optionIndex) => ({
          sectionId: row.id,
          value: option.value,
          label: option.label,
          sortOrder: optionIndex,
        })),
      );
    }
    if (weekly) {
      await db
        .insert(checklistItems)
        .values({ checklistId: weekly.id, sectionId: row.id, sortOrder: index });
    }
  }
}
