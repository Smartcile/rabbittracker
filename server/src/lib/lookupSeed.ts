import { count, eq } from "drizzle-orm";
import { DEFAULT_LOOKUPS, LOOKUP_KINDS } from "../../../shared/lookups.ts";
import { db } from "../db/index.ts";
import { lookups } from "../db/schema.ts";

export async function ensureLookupSeed(): Promise<void> {
  for (const kind of LOOKUP_KINDS) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(lookups)
      .where(eq(lookups.kind, kind));
    if (value > 0) continue;
    const items = DEFAULT_LOOKUPS[kind];
    if (items.length === 0) continue;
    await db.insert(lookups).values(
      items.map((item, index) => ({
        kind,
        value: item.value,
        label: item.label,
        defaultInt: item.defaultInt ?? null,
        defaultCents: item.defaultCents ?? null,
        sortOrder: index,
      })),
    );
  }
}

export async function addMissingDefaultLookups(): Promise<string[]> {
  const added: string[] = [];
  for (const kind of LOOKUP_KINDS) {
    const items = DEFAULT_LOOKUPS[kind];
    if (items.length === 0) continue;
    const rows = await db.select().from(lookups).where(eq(lookups.kind, kind));
    const existing = new Set(rows.map((row) => row.label.trim().toLowerCase()));
    const existingValues = new Set(rows.map((row) => row.value));
    const missing = items.filter(
      (item) => !existing.has(item.label.trim().toLowerCase()) && !existingValues.has(item.value),
    );
    if (missing.length === 0) continue;
    const highest = rows.reduce((value, row) => Math.max(value, row.sortOrder), -1);
    await db.insert(lookups).values(
      missing.map((item, index) => ({
        kind,
        value: item.value,
        label: item.label,
        defaultInt: item.defaultInt ?? null,
        defaultCents: item.defaultCents ?? null,
        sortOrder: highest + 1 + index,
      })),
    );
    added.push(...missing.map((item) => item.label));
  }
  return added;
}
