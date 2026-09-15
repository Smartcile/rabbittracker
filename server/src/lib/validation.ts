import { z } from "zod";
import { CALENDAR_REPEATS } from "../../../shared/calendar.ts";
import type { HealthChecklistDto } from "../../../shared/checklist.ts";
import { LOOKUP_KINDS } from "../../../shared/lookups.ts";
import { TASK_SLOTS } from "../../../shared/tasks.ts";
import { TREATMENT_SLOTS } from "../../../shared/treatments.ts";

export const usernameSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string()
    .regex(/^[a-z0-9._-]{3,32}$/, "Use 3-32 characters: a-z, 0-9, dot, underscore or hyphen"),
);

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

export const displayNameSchema = z.string().trim().max(100);

export const setupSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema.default(""),
  password: passwordSchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password is required"),
});

const pinDigits = z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits");

export const pinSchema = z.object({
  pin: pinDigits,
});

export const pinSetSchema = z.object({
  pin: z.union([pinDigits, z.null()]),
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1, "Current password is required"),
  next: passwordSchema,
});

const permissionFields = {
  canCreateRabbits: z.boolean().default(false),
  canRecordHealth: z.boolean().default(true),
  canEditRabbits: z.boolean().default(false),
  canViewCosts: z.boolean().default(false),
  canManageCalendar: z.boolean().default(false),
  canEditFaq: z.boolean().default(false),
};

const permissionPatchFields = {
  canCreateRabbits: z.boolean().optional(),
  canRecordHealth: z.boolean().optional(),
  canEditRabbits: z.boolean().optional(),
  canViewCosts: z.boolean().optional(),
  canManageCalendar: z.boolean().optional(),
  canEditFaq: z.boolean().optional(),
};

export const userCreateSchema = z.discriminatedUnion("isAdmin", [
  z.object({
    username: usernameSchema,
    displayName: displayNameSchema.default(""),
    isAdmin: z.literal(true),
    password: passwordSchema,
  }),
  z.object({
    username: usernameSchema,
    displayName: displayNameSchema.default(""),
    isAdmin: z.literal(false),
    pin: pinDigits,
    ...permissionFields,
  }),
]);

export const userUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    active: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    password: passwordSchema.optional(),
    pin: z.union([pinDigits, z.null()]).optional(),
    ...permissionPatchFields,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const demoToggleSchema = z.object({
  enabled: z.boolean(),
});

export const calendarSubscriptionSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  url: z.url("Enter a valid calendar URL"),
});

export const calendarSubscriptionUpdateSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(100).optional(),
    url: z.url("Enter a valid calendar URL").optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Invalid date");

const optionalDate = z
  .union([dateOnlySchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

export const rabbitCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sex: z.enum(["male", "female", "unknown"]).default("unknown"),
  breed: z.string().trim().max(100).default(""),
  colour: z.string().trim().max(100).default(""),
  dateOfBirth: optionalDate,
  desexed: z.boolean().default(false),
  microchip: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(2000).default(""),
  status: z.enum(["active", "deceased"]).default("active"),
  quarantined: z.boolean().default(false),
  quarantineUntil: optionalDate,
  targetWeightMinGrams: z.number().int().min(0).max(200000).nullable().optional(),
  targetWeightMaxGrams: z.number().int().min(0).max(200000).nullable().optional(),
  feedingPlan: z.string().trim().max(5000).default(""),
  deceasedAt: optionalDate,
  deceasedReason: z.string().trim().max(1000).default(""),
});

export const rabbitUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    sex: z.enum(["male", "female", "unknown"]).optional(),
    breed: z.string().trim().max(100).optional(),
    colour: z.string().trim().max(100).optional(),
    dateOfBirth: optionalDate,
    desexed: z.boolean().optional(),
    microchip: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
    status: z.enum(["active", "deceased"]).optional(),
    quarantined: z.boolean().optional(),
    quarantineUntil: optionalDate,
    targetWeightMinGrams: z.number().int().min(0).max(200000).nullable().optional(),
    targetWeightMaxGrams: z.number().int().min(0).max(200000).nullable().optional(),
    feedingPlan: z.string().trim().max(5000).optional(),
    deceasedAt: optionalDate,
    deceasedReason: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const rabbitCarersPutSchema = z.object({
  userIds: z.array(z.number().int().positive()),
});

export const rabbitBondsPutSchema = z.object({
  partnerIds: z.array(z.number().int().positive()),
});

export const checklistAnswerSchema = z.object({
  values: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  other: z.string().trim().max(500).default(""),
  numberMilli: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  text: z.string().trim().max(500).optional(),
});

export const checklistSchema = z.record(
  z.string().trim().min(1).max(60),
  checklistAnswerSchema,
);

export const checklistSectionCreateSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  hint: z.string().trim().max(500).default(""),
  multiple: z.boolean().default(false),
});

export const checklistSectionUpdateSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(100).optional(),
    hint: z.string().trim().max(500).optional(),
    multiple: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const checklistOptionCreateSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
});

export const checklistOptionUpdateSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
});

export const checklistPhotoUpdateSchema = z.object({
  caption: z.string().trim().max(200).default(""),
});

export const checklistReorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "No sections to reorder"),
});

export const vetCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  clinicId: z.number().int().positive().nullable().optional(),
  phone: z.string().trim().max(100).default(""),
  email: z.string().trim().max(200).default(""),
  address: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const vetUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200).optional(),
    clinicId: z.number().int().positive().nullable().optional(),
    phone: z.string().trim().max(100).optional(),
    email: z.string().trim().max(200).optional(),
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const clinicCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(100).default(""),
  email: z.string().trim().max(200).default(""),
  address: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const clinicUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200).optional(),
    phone: z.string().trim().max(100).optional(),
    email: z.string().trim().max(200).optional(),
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const lookupCreateSchema = z.object({
  kind: z.enum(LOOKUP_KINDS),
  label: z.string().trim().min(1, "Name is required").max(100),
  defaultInt: z.number().int().min(1).max(3650).nullable().optional(),
  defaultCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

export const lookupUpdateSchema = z
  .object({
    label: z.string().trim().min(1, "Name is required").max(100).optional(),
    defaultInt: z.number().int().min(1).max(3650).nullable().optional(),
    defaultCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const checkLogTypeCreateSchema = z.object({
  label: z.string().trim().min(1, "Name is required").max(100),
  unit: z.string().trim().max(30).default(""),
  hasNumber: z.boolean().default(true),
  hasText: z.boolean().default(false),
  multiple: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});

export const checkLogTypeUpdateSchema = z
  .object({
    label: z.string().trim().min(1, "Name is required").max(100).optional(),
    unit: z.string().trim().max(30).optional(),
    hasNumber: z.boolean().optional(),
    hasText: z.boolean().optional(),
    multiple: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const checkLogCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  loggedAt: z.coerce.date(),
  valueMilli: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  valueLabels: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  valueText: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const checkLogUpdateSchema = z
  .object({
    loggedAt: z.coerce.date().optional(),
    valueMilli: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    valueLabels: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    valueText: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const bowlCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  label: z.string().trim().min(1, "Name is required").max(100),
  startWeightGrams: z.number().int().min(0).max(1_000_000),
  startedAt: z.coerce.date(),
  notes: z.string().trim().max(2000).default(""),
});

export const bowlUpdateSchema = z.object({
  label: z.string().trim().min(1, "Name is required").max(100),
});

export const bowlReadingCreateSchema = z
  .object({
    kind: z.enum(["weigh", "refill", "refresh"]),
    readAt: z.coerce.date(),
    weightGrams: z.number().int().min(0).max(1_000_000).optional(),
    refillGrams: z.number().int().min(1).max(1_000_000).optional(),
    finalWeightGrams: z.number().int().min(0).max(1_000_000).optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine(
    (value) => (value.kind === "refill" ? value.refillGrams !== undefined : value.weightGrams !== undefined),
    { message: "Enter a weight" },
  );

export const taskCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  label: z.string().trim().min(1, "Name is required").max(200),
  slot: z.enum(TASK_SLOTS).default("anytime"),
  intervalDays: z.number().int().min(1).max(3650).default(1),
  notes: z.string().trim().max(2000).default(""),
  active: z.boolean().default(true),
});

export const taskUpdateSchema = z
  .object({
    label: z.string().trim().min(1, "Name is required").max(200).optional(),
    slot: z.enum(TASK_SLOTS).optional(),
    intervalDays: z.number().int().min(1).max(3650).optional(),
    notes: z.string().trim().max(2000).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const taskCompleteSchema = z.object({
  completedAt: z.coerce.date(),
  notes: z.string().trim().max(2000).default(""),
});

export const medicationLogCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  treatmentId: z.number().int().positive().nullable().optional(),
  drugId: z.number().int().positive().nullable().optional(),
  givenAt: z.coerce.date(),
  slot: z.enum(TREATMENT_SLOTS).nullable().optional(),
  amountMilliUnits: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  notes: z.string().trim().max(2000).default(""),
});

export const medicationLogUpdateSchema = z
  .object({
    treatmentId: z.number().int().positive().nullable().optional(),
    drugId: z.number().int().positive().nullable().optional(),
    givenAt: z.coerce.date().optional(),
    slot: z.enum(TREATMENT_SLOTS).nullable().optional(),
    amountMilliUnits: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const calendarEntryCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  type: z.string().trim().max(60).default("other"),
  startAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  location: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(2000).default(""),
  rabbitId: z.number().int().positive().nullable().optional(),
  repeat: z.enum(CALENDAR_REPEATS).default("none"),
  repeatUntil: optionalDate,
});

export const calendarEntryUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200).optional(),
    type: z.string().trim().max(60).optional(),
    startAt: z.coerce.date().optional(),
    allDay: z.boolean().optional(),
    location: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
    rabbitId: z.number().int().positive().nullable().optional(),
    repeat: z.enum(CALENDAR_REPEATS).optional(),
    repeatUntil: optionalDate,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const journalEntryCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  note: z.string().trim().max(2000).default(""),
});

export const journalEntryUpdateSchema = z.object({
  note: z.string().trim().max(2000),
});

export const journalPhotoUpdateSchema = z.object({
  caption: z.string().trim().max(200).default(""),
});

export const appetiteSchema = z.enum(["normal", "reduced", "none"]);
export const droppingsSchema = z.enum(["normal", "small", "few", "none"]);
export const energySchema = z.enum(["normal", "low", "high"]);

export type CheckContent = {
  weightGrams?: number | null;
  appetite?: string | null;
  droppings?: string | null;
  energy?: string | null;
  bodyCondition?: number | null;
  temperatureTenthsC?: number | null;
  painScore?: number | null;
  checklist?: HealthChecklistDto | null;
  notes?: string | null;
};

export function hasChecklistContent(checklist: HealthChecklistDto | null | undefined): boolean {
  if (!checklist) return false;
  return Object.values(checklist).some(
    (answer) =>
      answer.values.length > 0 ||
      answer.other.trim().length > 0 ||
      answer.numberMilli != null ||
      (answer.text ?? "").trim().length > 0,
  );
}

export function hasCheckContent(value: CheckContent): boolean {
  return (
    value.weightGrams != null ||
    (value.notes ?? "").trim().length > 0 ||
    value.appetite != null ||
    value.droppings != null ||
    value.energy != null ||
    value.bodyCondition != null ||
    value.temperatureTenthsC != null ||
    value.painScore != null ||
    hasChecklistContent(value.checklist)
  );
}

export const checkCreateSchema = z
  .object({
    rabbitId: z.number().int().positive(),
    checkedAt: z.coerce.date(),
    weightGrams: z.number().int().min(0).max(200000).nullable().optional(),
    appetite: appetiteSchema.nullable().optional(),
    droppings: droppingsSchema.nullable().optional(),
    energy: energySchema.nullable().optional(),
    bodyCondition: z.number().int().min(1).max(5).nullable().optional(),
    temperatureTenthsC: z.number().int().min(200).max(450).nullable().optional(),
    painScore: z.number().int().min(0).max(10).nullable().optional(),
    checklist: checklistSchema.optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine((value) => hasCheckContent(value), {
    message: "Add a weight, a status or notes",
  });

export const checkUpdateSchema = z
  .object({
    checkedAt: z.coerce.date().optional(),
    weightGrams: z.number().int().min(0).max(200000).nullable().optional(),
    appetite: appetiteSchema.nullable().optional(),
    droppings: droppingsSchema.nullable().optional(),
    energy: energySchema.nullable().optional(),
    bodyCondition: z.number().int().min(1).max(5).nullable().optional(),
    temperatureTenthsC: z.number().int().min(200).max(450).nullable().optional(),
    painScore: z.number().int().min(0).max(10).nullable().optional(),
    checklist: checklistSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const treatmentCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  medication: z.string().trim().min(1, "Medication is required").max(200),
  dose: z.string().trim().max(100).default(""),
  route: z.string().trim().max(100).default(""),
  frequency: z.string().trim().max(100).default(""),
  slots: z.array(z.enum(TREATMENT_SLOTS)).max(TREATMENT_SLOTS.length).default([]),
  reason: z.string().trim().max(300).default(""),
  startDate: dateOnlySchema,
  endDate: optionalDate,
  status: z.enum(["active", "completed", "stopped"]).default("active"),
  notes: z.string().trim().max(2000).default(""),
  drugId: z.number().int().positive().nullable().optional(),
  doseMilliUnits: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

export const treatmentUpdateSchema = z
  .object({
    medication: z.string().trim().min(1, "Medication is required").max(200).optional(),
    dose: z.string().trim().max(100).optional(),
    route: z.string().trim().max(100).optional(),
    frequency: z.string().trim().max(100).optional(),
    slots: z.array(z.enum(TREATMENT_SLOTS)).max(TREATMENT_SLOTS.length).optional(),
    reason: z.string().trim().max(300).optional(),
    startDate: dateOnlySchema.optional(),
    endDate: optionalDate,
    status: z.enum(["active", "completed", "stopped"]).optional(),
    notes: z.string().trim().max(2000).optional(),
    drugId: z.number().int().positive().nullable().optional(),
    doseMilliUnits: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const drugFormSchema = z.enum(["liquid", "tablet", "paste", "powder", "injection", "other"]);

const optionalPositiveInt = z.number().int().positive().max(1_000_000_000).nullable().optional();

export const drugCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  activeIngredient: z.string().trim().max(200).default(""),
  form: drugFormSchema.default("liquid"),
  unit: z.string().trim().min(1, "Unit is required").max(30).default("ml"),
  concentrationMicrogramsPerUnit: optionalPositiveInt,
  doseMicrogramsPerKg: optionalPositiveInt,
  dosesPerDay: z.number().int().min(1).max(12).default(1),
  route: z.string().trim().max(100).default(""),
  frequency: z.string().trim().max(100).default(""),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  howToUse: z.string().trim().max(5000).default(""),
  warnings: z.string().trim().max(5000).default(""),
  reorderLevelMilliUnits: z.number().int().min(0).max(1_000_000_000).default(0),
});

export const drugUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200).optional(),
    activeIngredient: z.string().trim().max(200).optional(),
    form: drugFormSchema.optional(),
    unit: z.string().trim().min(1, "Unit is required").max(30).optional(),
    concentrationMicrogramsPerUnit: optionalPositiveInt,
    doseMicrogramsPerKg: optionalPositiveInt,
    dosesPerDay: z.number().int().min(1).max(12).optional(),
    route: z.string().trim().max(100).optional(),
    frequency: z.string().trim().max(100).optional(),
    durationDays: z.number().int().min(1).max(3650).nullable().optional(),
    howToUse: z.string().trim().max(5000).optional(),
    warnings: z.string().trim().max(5000).optional(),
    reorderLevelMilliUnits: z.number().int().min(0).max(1_000_000_000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const drugBatchCreateSchema = z.object({
  quantityMilliUnits: z.number().int().min(0).max(1_000_000_000).default(0),
  expiryDate: optionalDate,
  batch: z.string().trim().max(100).default(""),
  supplier: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const drugBatchUpdateSchema = z
  .object({
    quantityMilliUnits: z.number().int().min(0).max(1_000_000_000).optional(),
    expiryDate: optionalDate,
    batch: z.string().trim().max(100).optional(),
    supplier: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const vaccineSchema = z.string().trim().min(1, "Vaccine is required").max(100);

export const vaccinationCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  vaccine: vaccineSchema,
  givenAt: dateOnlySchema,
  nextDueAt: optionalDate,
  vet: z.string().trim().max(200).default(""),
  batch: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const vaccinationUpdateSchema = z
  .object({
    vaccine: vaccineSchema.optional(),
    givenAt: dateOnlySchema.optional(),
    nextDueAt: optionalDate,
    vet: z.string().trim().max(200).optional(),
    batch: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const careKindSchema = z.string().trim().min(1, "Care type is required").max(60);

export const careSchedulePutSchema = z.object({
  kind: careKindSchema,
  intervalDays: z
    .number()
    .int()
    .min(1, "Interval must be at least 1 day")
    .max(3650, "Interval is too long"),
});

export const careRecordCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  kind: careKindSchema,
  doneAt: dateOnlySchema,
  notes: z.string().trim().max(2000).default(""),
});

export const appointmentStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);

const optionalTimestamp = z
  .union([z.literal(""), z.null(), z.coerce.date()])
  .optional()
  .transform((value) =>
    value === undefined ? undefined : value === "" || value === null ? null : value,
  );

export const appointmentCreateSchema = z.object({
  rabbitId: z.number().int().positive(),
  title: z.string().trim().min(1, "Title is required").max(200),
  clinic: z.string().trim().max(200).default(""),
  vet: z.string().trim().max(200).default(""),
  location: z.string().trim().max(300).default(""),
  scheduledAt: z.coerce.date(),
  status: appointmentStatusSchema.default("scheduled"),
  costCents: z.number().int().min(0).max(100000000).nullable().optional(),
  followUpAt: optionalTimestamp,
  eventUid: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).default(""),
});

export const appointmentUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200).optional(),
    clinic: z.string().trim().max(200).optional(),
    vet: z.string().trim().max(200).optional(),
    location: z.string().trim().max(300).optional(),
    scheduledAt: z.coerce.date().optional(),
    status: appointmentStatusSchema.optional(),
    costCents: z.number().int().min(0).max(100000000).nullable().optional(),
    followUpAt: optionalTimestamp,
    eventUid: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const faqCreateSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(100),
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(5000),
});

export const faqUpdateSchema = z
  .object({
    category: z.string().trim().min(1, "Category is required").max(100).optional(),
    question: z.string().trim().min(1, "Question is required").max(300).optional(),
    answer: z.string().trim().min(1, "Answer is required").max(5000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes provided",
  });

export const faqReorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "No entries to reorder"),
});
