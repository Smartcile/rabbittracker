import type { DrugForm } from "../../../shared/drugs.ts";

export type SeedDrug = {
  name: string;
  activeIngredient: string;
  form: DrugForm;
  unit: string;
  concentrationMicrogramsPerUnit: number | null;
  doseMicrogramsPerKg: number | null;
  dosesPerDay: number;
  route: string;
  frequency: string;
  durationDays: number | null;
  howToUse: string;
  warnings: string;
  reorderLevelMilliUnits: number;
};

export function drugSeedKey(
  drug: Pick<SeedDrug, "activeIngredient" | "concentrationMicrogramsPerUnit"> & { form: string },
): string {
  return [
    drug.activeIngredient.trim().toLowerCase(),
    drug.form,
    drug.concentrationMicrogramsPerUnit ?? "",
  ].join("|");
}

export const DRUG_SEED: SeedDrug[] = [
  {
    name: "Meloxicam oral suspension (Metacam)",
    activeIngredient: "meloxicam",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 1500,
    doseMicrogramsPerKg: 500,
    dosesPerDay: 2,
    route: "oral",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse:
      "Give directly into the mouth with a syringe or on a small piece of food. Give with or after food to reduce stomach upset.",
    warnings:
      "NSAID — never combine with steroids or another NSAID. Typical range 0.3–0.6 mg/kg; confirm dose and long-term use with your vet.",
    reorderLevelMilliUnits: 5000,
  },
  {
    name: "Enrofloxacin 2.5% injection (Baytril)",
    activeIngredient: "enrofloxacin",
    form: "injection",
    unit: "ml",
    concentrationMicrogramsPerUnit: 25000,
    doseMicrogramsPerKg: 5000,
    dosesPerDay: 2,
    route: "subcutaneous",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse: "Inject under the skin as shown by your vet. Rotate injection sites.",
    warnings:
      "Typical range 5–10 mg/kg twice daily. Do not mix with dairy. Use with caution in young, growing rabbits — confirm with your vet.",
    reorderLevelMilliUnits: 5000,
  },
  {
    name: "Fenbendazole 10% oral suspension (Panacur)",
    activeIngredient: "fenbendazole",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 100000,
    doseMicrogramsPerKg: 20000,
    dosesPerDay: 1,
    route: "oral",
    frequency: "once daily",
    durationDays: 5,
    howToUse: "Draw up the dose and give directly into the mouth with a syringe.",
    warnings:
      "Course length depends on the condition being treated (often 5–28 days) — follow your vet's plan.",
    reorderLevelMilliUnits: 10000,
  },
  {
    name: "Metoclopramide 5 mg/ml injection",
    activeIngredient: "metoclopramide",
    form: "injection",
    unit: "ml",
    concentrationMicrogramsPerUnit: 5000,
    doseMicrogramsPerKg: 500,
    dosesPerDay: 3,
    route: "subcutaneous",
    frequency: "every 8 hours",
    durationDays: null,
    howToUse: "Inject under the skin as shown by your vet.",
    warnings:
      "For gut motility — do not use if a blockage is suspected. Veterinary advice required.",
    reorderLevelMilliUnits: 5000,
  },
  {
    name: "Metronidazole 40 mg/ml oral suspension",
    activeIngredient: "metronidazole",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 40000,
    doseMicrogramsPerKg: 15000,
    dosesPerDay: 2,
    route: "oral",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse: "Give directly into the mouth with a syringe.",
    warnings: "Typical range 10–20 mg/kg twice daily — confirm with your vet.",
    reorderLevelMilliUnits: 10000,
  },
  {
    name: "Doxycycline 10 mg/ml oral suspension",
    activeIngredient: "doxycycline",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 10000,
    doseMicrogramsPerKg: 5000,
    dosesPerDay: 2,
    route: "oral",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse: "Give directly into the mouth; follow with a little food or water if possible.",
    warnings:
      "Keep out of strong sunlight while in use. Typical range 2.5–5 mg/kg twice daily — confirm with your vet.",
    reorderLevelMilliUnits: 10000,
  },
  {
    name: "Doxy 100 paste (100 mg/ml)",
    activeIngredient: "doxycycline",
    form: "paste",
    unit: "ml",
    concentrationMicrogramsPerUnit: 100000,
    doseMicrogramsPerKg: null,
    dosesPerDay: 2,
    route: "oral",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse:
      "Doxy 100 paste in a 2.5 g tube — the prescribed dose is a fixed 0.02 ml per dose. Measure with a small syringe and give directly into the mouth.",
    warnings:
      "100 mg/ml (10x the 10 mg/ml suspension). Fixed 0.02 ml dose as prescribed; no weight-based dose is set, so add one only if your vet gives mg/kg. Typical rabbit range 2.5–5 mg/kg twice daily — confirm with your vet.",
    reorderLevelMilliUnits: 0,
  },
  {
    name: "Trimethoprim Sulfa 240 mg/5 ml (Deprim)",
    activeIngredient: "trimethoprim + sulfamethoxazole",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 48000,
    doseMicrogramsPerKg: 24000,
    dosesPerDay: 2,
    route: "oral",
    frequency: "every 12 hours",
    durationDays: null,
    howToUse:
      "Deprim 240 mg/5 ml (48 mg/ml): 0.5 ml per kg twice daily. Give directly into the mouth with a syringe. Give with food and keep fresh water available.",
    warnings:
      "Trimethoprim 8 mg/ml + sulfamethoxazole 40 mg/ml — 0.5 ml per kg twice daily. Typical range 15–30 mg/kg twice daily; confirm dose and course length with your vet.",
    reorderLevelMilliUnits: 10000,
  },
  {
    name: "Ivermectin 1% injection",
    activeIngredient: "ivermectin",
    form: "injection",
    unit: "ml",
    concentrationMicrogramsPerUnit: 10000,
    doseMicrogramsPerKg: 300,
    dosesPerDay: 1,
    route: "subcutaneous",
    frequency: "every 10–14 days",
    durationDays: 1,
    howToUse: "Inject under the skin; repeat only as directed by your vet.",
    warnings: "Narrow safety margin — measure carefully. Typical range 0.2–0.4 mg/kg.",
    reorderLevelMilliUnits: 2000,
  },
  {
    name: "Selamectin topical (Revolution)",
    activeIngredient: "selamectin",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 60000,
    doseMicrogramsPerKg: 12000,
    dosesPerDay: 1,
    route: "topical",
    frequency: "monthly",
    durationDays: 1,
    howToUse: "Part the fur between the shoulder blades and apply directly to the skin.",
    warnings:
      "Use the pipette size that matches your rabbit's weight. Typical range 6–18 mg/kg monthly — confirm with your vet.",
    reorderLevelMilliUnits: 1000,
  },
  {
    name: "Simethicone infant gas drops",
    activeIngredient: "simethicone",
    form: "liquid",
    unit: "ml",
    concentrationMicrogramsPerUnit: 66700,
    doseMicrogramsPerKg: 25000,
    dosesPerDay: 4,
    route: "oral",
    frequency: "every 6 hours as needed",
    durationDays: null,
    howToUse: "Give directly into the mouth. May repeat as directed.",
    warnings:
      "Supportive care for gas only — contact your vet if your rabbit is not eating or has no droppings.",
    reorderLevelMilliUnits: 10000,
  },
  {
    name: "Critical Care recovery food (Oxbow)",
    activeIngredient: "recovery food",
    form: "powder",
    unit: "g",
    concentrationMicrogramsPerUnit: null,
    doseMicrogramsPerKg: null,
    dosesPerDay: 1,
    route: "oral",
    frequency: "as directed",
    durationDays: null,
    howToUse:
      "Mix 1 part powder with 2 parts warm water. Feed slowly by syringe, letting your rabbit swallow between mouthfuls.",
    warnings: "Supportive feeding only — follow your vet's feeding plan.",
    reorderLevelMilliUnits: 500000,
  },
];
