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
