import { and, asc, eq } from "drizzle-orm";
import { slugifyLabel } from "../../../shared/checklist.ts";
import { db } from "../db/index.ts";
import { lookups } from "../db/schema.ts";
import type { LookupRow } from "../db/schema.ts";
import { HttpError } from "./http.ts";

export async function listLookups(kind?: string): Promise<LookupRow[]> {
  const query = db.select().from(lookups).orderBy(asc(lookups.sortOrder), asc(lookups.id));
  if (kind === undefined) return query;
  return db
    .select()
    .from(lookups)
    .where(eq(lookups.kind, kind))
    .orderBy(asc(lookups.sortOrder), asc(lookups.id));
}

export async function lookupValues(kind: string): Promise<string[]> {
  const rows = await listLookups(kind);
  return rows.map((row) => row.value);
}

export async function findLookup(id: number): Promise<LookupRow> {
  const rows = await db.select().from(lookups).where(eq(lookups.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "List item not found");
  return rows[0];
}

export async function uniqueLookupValue(kind: string, label: string): Promise<string> {
  const rows = await db
    .select({ value: lookups.value })
    .from(lookups)
    .where(and(eq(lookups.kind, kind)));
  const taken = new Set(rows.map((row) => row.value));
  const base = slugifyLabel(label);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
