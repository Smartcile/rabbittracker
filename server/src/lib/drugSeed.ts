import { count } from "drizzle-orm";
import { db } from "../db/index.ts";
import { drugs } from "../db/schema.ts";
import { DRUG_SEED, drugSeedKey } from "./drugSeedData.ts";

export async function ensureDrugSeed(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(drugs);
  if (value > 0) return;
  await db.insert(drugs).values(DRUG_SEED);
}

export async function addMissingDefaultDrugs(): Promise<string[]> {
  const rows = await db.select().from(drugs);
  const names = new Set(rows.map((row) => row.name.trim().toLowerCase()));
  const keys = new Set(rows.map((row) => drugSeedKey(row)));
  const missing = DRUG_SEED.filter(
    (drug) => !names.has(drug.name.trim().toLowerCase()) && !keys.has(drugSeedKey(drug)),
  );
  if (missing.length === 0) return [];
  await db.insert(drugs).values(missing);
  return missing.map((drug) => drug.name);
}
