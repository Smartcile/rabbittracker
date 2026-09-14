import { asc } from "drizzle-orm";
import { db } from "../db/index.ts";
import { checkLogTypes } from "../db/schema.ts";
import type { CheckLogTypeRow } from "../db/schema.ts";

export async function listCheckLogTypes(): Promise<CheckLogTypeRow[]> {
  return db
    .select()
    .from(checkLogTypes)
    .orderBy(asc(checkLogTypes.sortOrder), asc(checkLogTypes.id));
}
