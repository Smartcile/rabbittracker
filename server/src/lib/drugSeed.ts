import { count } from "drizzle-orm";
import { db } from "../db/index.ts";
import { drugs } from "../db/schema.ts";
import { DRUG_SEED } from "./drugSeedData.ts";

export async function ensureDrugSeed(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(drugs);
  if (value > 0) return;
  await db.insert(drugs).values(DRUG_SEED);
}
