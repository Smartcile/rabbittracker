import { count, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { breedNorms } from "../db/schema.ts";

export const BREED_NORM_SEED = [
  { breed: "New Zealand White", minGrams: 4000, maxGrams: 5400 },
  { breed: "Lionhead", minGrams: 1300, maxGrams: 1700 },
  { breed: "Mini Lop", minGrams: 2300, maxGrams: 3200 },
  { breed: "Netherland Dwarf", minGrams: 800, maxGrams: 1200 },
  { breed: "Dutch", minGrams: 1800, maxGrams: 2500 },
  { breed: "Rex", minGrams: 3000, maxGrams: 4500 },
  { breed: "Californian", minGrams: 3600, maxGrams: 4800 },
  { breed: "Angora", minGrams: 2000, maxGrams: 3500 },
  { breed: "Flemish Giant", minGrams: 5000, maxGrams: 8000 },
  { breed: "Mixed breed", minGrams: 1500, maxGrams: 3000 },
];

export async function ensureBreedNormSeed(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(breedNorms);
  if (value > 0) return;
  await db.insert(breedNorms).values(BREED_NORM_SEED);
}

export async function addMissingDefaultBreedNorms(): Promise<string[]> {
  const rows = await db.select().from(breedNorms);
  const existing = new Set(rows.map((row) => row.breed.trim().toLowerCase()));
  const missing = BREED_NORM_SEED.filter(
    (norm) => !existing.has(norm.breed.trim().toLowerCase()),
  );
  if (missing.length === 0) return [];
  await db.insert(breedNorms).values(missing);
  return missing.map((norm) => norm.breed);
}

export async function findBreedNorm(breed: string) {
  const rows = await db
    .select()
    .from(breedNorms)
    .where(eq(breedNorms.breed, breed))
    .limit(1);
  return rows[0] ?? null;
}
