import { count } from "drizzle-orm";
import { db } from "../db/index.ts";
import { growthStages } from "../db/schema.ts";

type SeedStage = {
  label: string;
  guidance: string;
  startDays: number;
  endDays: number;
  sex: "any" | "male" | "female";
};

export const GROWTH_STAGE_SEED: SeedStage[] = [
  {
    label: "Nest and nursing",
    guidance:
      "With mum and littermates. Keep handling to a minimum and the nest warm, dry and quiet.",
    startDays: 0,
    endDays: 21,
    sex: "any",
  },
  {
    label: "Weaning",
    guidance:
      "Introduce alfalfa hay and junior pellets while still with mum; fully weaned by about 8 weeks. Separate males from females once they are eating independently.",
    startDays: 21,
    endDays: 56,
    sex: "any",
  },
  {
    label: "Juvenile diet and first vet check",
    guidance:
      "Unlimited alfalfa hay plus measured junior pellets. Book the first vet check, confirm the sex and start RHDV2 vaccination if it is used in your area.",
    startDays: 56,
    endDays: 120,
    sex: "any",
  },
  {
    label: "Desexing window",
    guidance:
      "Does are usually desexed from about 5–6 months. Desexing prevents uterine cancer and unwanted litters — book with your vet.",
    startDays: 140,
    endDays: 210,
    sex: "female",
  },
  {
    label: "Desexing window",
    guidance:
      "Bucks are usually desexed from about 4–5 months, once the testicles have descended. Book with your vet.",
    startDays: 120,
    endDays: 180,
    sex: "male",
  },
  {
    label: "Transition to adult diet",
    guidance:
      "Swap alfalfa for grass hay and move to measured adult pellets (about 1/4 cup per 2.5 kg). Keep hay unlimited and introduce greens slowly.",
    startDays: 180,
    endDays: 240,
    sex: "any",
  },
  {
    label: "Adult routine",
    guidance:
      "Grass hay, measured pellets and daily greens. Yearly vet check, nails every 4–8 weeks and a monthly weigh-in to catch changes early.",
    startDays: 240,
    endDays: 1460,
    sex: "any",
  },
  {
    label: "Senior care",
    guidance:
      "From about 4 years: weigh monthly, watch for dental issues, reduced mobility and weight loss, and book a vet check every 6 months.",
    startDays: 1460,
    endDays: 20000,
    sex: "any",
  },
];

export async function ensureGrowthStageSeed(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(growthStages);
  if (value > 0) return;
  await db.insert(growthStages).values(
    GROWTH_STAGE_SEED.map((stage, index) => ({ ...stage, sortOrder: index })),
  );
}

export async function addMissingDefaultGrowthStages(): Promise<string[]> {
  const rows = await db.select().from(growthStages);
  const existing = new Set(rows.map((row) => row.label.trim().toLowerCase()));
  const missing = GROWTH_STAGE_SEED.filter(
    (stage) => !existing.has(stage.label.trim().toLowerCase()),
  );
  if (missing.length === 0) return [];
  const highest = rows.reduce((value, row) => Math.max(value, row.sortOrder), -1);
  await db.insert(growthStages).values(
    missing.map((stage, index) => ({ ...stage, sortOrder: highest + 1 + index })),
  );
  return missing.map((stage) => stage.label);
}
