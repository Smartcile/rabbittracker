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
