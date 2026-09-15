import { count } from "drizzle-orm";
import { db } from "../db/index.ts";
import { checkLogTypes } from "../db/schema.ts";

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
    key: "water",
    label: "Water intake",
    unit: "ml",
    hasNumber: true,
    hasText: false,
    multiple: false,
    options: [],
  },
  {
    key: "food",
    label: "Food",
    unit: "g",
    hasNumber: true,
    hasText: true,
    multiple: false,
    options: [],
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
  const [{ value }] = await db.select({ value: count() }).from(checkLogTypes);
  if (value > 0) return;
  await db.insert(checkLogTypes).values(
    DEFAULT_CHECK_LOG_TYPES.map((type, index) => ({ ...type, sortOrder: index })),
  );
}

export async function addMissingDefaultCheckLogTypes(): Promise<string[]> {
  const rows = await db.select().from(checkLogTypes);
  const existing = new Set(rows.map((row) => row.key));
  const missing = DEFAULT_CHECK_LOG_TYPES.filter((type) => !existing.has(type.key));
  if (missing.length === 0) return [];
  const highest = rows.reduce((value, row) => Math.max(value, row.sortOrder), -1);
  await db.insert(checkLogTypes).values(
    missing.map((type, index) => ({ ...type, sortOrder: highest + 1 + index })),
  );
  return missing.map((type) => type.label);
}
