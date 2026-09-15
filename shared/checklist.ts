export type ChecklistOption = {
  value: string;
  label: string;
};

export type ChecklistSectionConfig = {
  key: string;
  label: string;
  hint: string;
  multiple: boolean;
  unit?: string;
  hasNumber?: boolean;
  hasText?: boolean;
  options: ChecklistOption[];
};

export type ChecklistAnswerDto = {
  values: string[];
  other: string;
  numberMilli?: number | null;
  text?: string;
};

export type HealthChecklistDto = Record<string, ChecklistAnswerDto>;

export type ChecklistDailyTypeConfig = {
  key: string;
  label: string;
  multiple: boolean;
  hasNumber: boolean;
  hasText: boolean;
  options: string[];
};

export const DAILY_CHECK_KEY_PREFIX = "daily:";

export function dailyCheckAnswerKey(typeKey: string): string {
  return `${DAILY_CHECK_KEY_PREFIX}${typeKey}`;
}

export function isDailyCheckAnswerKey(key: string): boolean {
  return key.startsWith(DAILY_CHECK_KEY_PREFIX);
}

export const DEFAULT_CHECKLIST_SECTIONS: ChecklistSectionConfig[] = [
  {
    key: "posture",
    label: "Posture",
    hint: "How is the animal holding its body when relaxed and comfortable? Does it always look hunched or sit funny?",
    multiple: false,
    options: [
      { value: "hunched", label: "Hunched" },
      { value: "relaxed", label: "Relaxed" },
      { value: "uncomfortable", label: "Uncomfortable / sitting funny" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "demeanour",
    label: "Demeanour",
    hint: "Does the animal look bright, alert, depressed, quiet or not responsive?",
    multiple: false,
    options: [
      { value: "bright", label: "Bright" },
      { value: "alert", label: "Alert" },
      { value: "depressed", label: "Depressed" },
      { value: "quiet", label: "Quiet" },
      { value: "not_responsive", label: "Not responsive" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "eyes",
    label: "Eyes",
    hint: "Look for any sign of discharge, redness, crustiness or cloudiness.",
    multiple: true,
    options: [
      { value: "bright_normal", label: "Bright and normal" },
      { value: "dull_sunken", label: "Dull, sunken or half closed" },
      { value: "watery", label: "Watery or discharging" },
      { value: "crusty", label: "Crusty" },
      { value: "red", label: "Red or inflamed" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "respiratory",
    label: "Breathing",
    hint: "Sit quietly and watch chest movements. Count breaths per minute if possible.",
    multiple: false,
    options: [
      { value: "normal", label: "Breathing normally" },
      { value: "noisy", label: "Noisy breathing" },
      { value: "slow", label: "Breathing slowly" },
      { value: "fast", label: "Breathing fast" },
      { value: "laboured", label: "Laboured breathing" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "coatSkin",
    label: "Coat & skin",
    hint: "Is the coat shiny and soft? Any dandruff, scaling, bald patches, redness or sores?",
    multiple: true,
    options: [
      { value: "soft_shiny", label: "Soft and shiny" },
      { value: "dull_scruffy", label: "Dull or scruffy" },
      { value: "flaky_dandruff", label: "Flaky or dandruff" },
      { value: "bald_patches", label: "Bald patches" },
      { value: "sores", label: "Sores or redness" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "behaviour",
    label: "Behaviour",
    hint: "Does the animal appear relaxed, quiet, scared, friendly, anxious or aggressive?",
    multiple: false,
    options: [
      { value: "relaxed", label: "Relaxed" },
      { value: "quiet", label: "Quiet" },
      { value: "scared", label: "Scared" },
      { value: "friendly", label: "Friendly" },
      { value: "anxious", label: "Anxious" },
      { value: "aggressive", label: "Aggressive" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "bum",
    label: "Bum / rear",
    hint: "Any signs of discharge or swelling? Is the area clean and not sore?",
    multiple: true,
    options: [
      { value: "normal", label: "Normal" },
      { value: "discharge", label: "Discharge" },
      { value: "swelling", label: "Swelling" },
      { value: "sore", label: "Sore or red" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "ears",
    label: "Ears",
    hint: "Any wax, head tilt, scratching or smell?",
    multiple: true,
    options: [
      { value: "clean", label: "Clean" },
      { value: "excess_wax", label: "Excess wax" },
      { value: "shaking_head", label: "Shaking head" },
      { value: "head_tilt", label: "Head tilt" },
      { value: "smell", label: "Smell" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "nails",
    label: "Nails",
    hint: "How long are the nails? Any broken, splitting or bleeding nails?",
    multiple: true,
    options: [
      { value: "short", label: "Short" },
      { value: "clipping_soon", label: "Need clipping soon" },
      { value: "clipping_asap", label: "Need clipping ASAP" },
      { value: "broken", label: "Broken nail" },
      { value: "splitting", label: "Splitting nails" },
      { value: "bleeding", label: "Bleeding nail" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "genitals",
    label: "Genitals / urinary",
    hint: "Any urine staining, redness or swelling?",
    multiple: true,
    options: [
      { value: "normal", label: "Normal" },
      { value: "urine_staining", label: "Urine staining" },
      { value: "red_swollen", label: "Red or swollen" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "hocks",
    label: "Hocks (back feet)",
    hint: "Is the fur-padded area at the back of the feet damaged or sore?",
    multiple: true,
    options: [
      { value: "normal", label: "Normal" },
      { value: "red_sore", label: "Red or sore" },
      { value: "bald", label: "Bald" },
      { value: "other", label: "Other" },
    ],
  },
];

export function emptyChecklist(): HealthChecklistDto {
  return {};
}

export function validateChecklistAnswers(
  answers: HealthChecklistDto,
  sections: ChecklistSectionConfig[],
  dailyTypes: ChecklistDailyTypeConfig[] = [],
): string | null {
  const dailyByKey = new Map(dailyTypes.map((type) => [type.key, type]));
  for (const [key, answer] of Object.entries(answers)) {
    if (isDailyCheckAnswerKey(key)) {
      const type = dailyByKey.get(key.slice(DAILY_CHECK_KEY_PREFIX.length));
      if (!type) return `Unknown daily check: ${key}`;
      if (answer.numberMilli != null) {
        if (!type.hasNumber) return `${type.label} does not take an amount`;
        if (!Number.isInteger(answer.numberMilli) || answer.numberMilli < 0) {
          return `Invalid amount for ${type.label}`;
        }
      }
      if (answer.text && !type.hasText) return `${type.label} does not take text`;
      if (answer.values.length > 0) {
        if (type.options.length === 0) return `${type.label} does not take options`;
        if (!type.multiple && answer.values.length > 1) {
          return `${type.label} allows only one answer`;
        }
        const allowed = new Set(type.options);
        for (const value of answer.values) {
          if (!allowed.has(value)) return `Unknown option for ${type.label}: ${value}`;
        }
      }
      continue;
    }
    const section = sections.find((item) => item.key === key);
    if (!section) return `Unknown checklist section: ${key}`;
    if (answer.numberMilli != null) {
      if (!section.hasNumber) return `${section.label} does not take an amount`;
      if (!Number.isInteger(answer.numberMilli) || answer.numberMilli < 0) {
        return `Invalid amount for ${section.label}`;
      }
    }
    if (answer.text && !section.hasText) return `${section.label} does not take text`;
    if (!section.multiple && answer.values.length > 1) {
      return `${section.label} allows only one answer`;
    }
    const allowed = new Set(section.options.map((option) => option.value));
    for (const value of answer.values) {
      if (!allowed.has(value)) return `Unknown option for ${section.label}: ${value}`;
    }
  }
  return null;
}

export function checklistOptionLabel(
  sections: ChecklistSectionConfig[],
  sectionKey: string,
  value: string,
): string {
  const section = sections.find((item) => item.key === sectionKey);
  return section?.options.find((option) => option.value === value)?.label ?? value;
}

export function slugifyLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "item";
}
