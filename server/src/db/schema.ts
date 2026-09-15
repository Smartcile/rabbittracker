import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { HealthChecklistDto } from "../../../shared/checklist.ts";

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  timezone: text("timezone").notNull().default("Pacific/Auckland"),
  feedToken: text("feed_token").notNull().default(""),
  shareToken: text("share_token").notNull().default(""),
  demoMode: boolean("demo_mode").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash"),
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  canCreateRabbits: boolean("can_create_rabbits").notNull().default(false),
  canRecordHealth: boolean("can_record_health").notNull().default(true),
  canEditRabbits: boolean("can_edit_rabbits").notNull().default(false),
  canViewCosts: boolean("can_view_costs").notNull().default(false),
  canManageCalendar: boolean("can_manage_calendar").notNull().default(false),
  canEditFaq: boolean("can_edit_faq").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rabbits = pgTable("rabbits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  sex: text("sex").notNull().default("unknown"),
  breed: text("breed").notNull().default(""),
  colour: text("colour").notNull().default(""),
  dateOfBirth: date("date_of_birth"),
  desexed: boolean("desexed").notNull().default(false),
  microchip: text("microchip").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("active"),
  hasAvatar: boolean("has_avatar").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  quarantined: boolean("quarantined").notNull().default(false),
  quarantineUntil: date("quarantine_until"),
  targetWeightMinGrams: integer("target_weight_min_grams"),
  targetWeightMaxGrams: integer("target_weight_max_grams"),
  feedingPlan: text("feeding_plan").notNull().default(""),
  deceasedAt: date("deceased_at"),
  deceasedReason: text("deceased_reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkLogTypes = pgTable("check_log_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  unit: text("unit").notNull().default(""),
  hasNumber: boolean("has_number").notNull().default(true),
  hasText: boolean("has_text").notNull().default(false),
  multiple: boolean("multiple").notNull().default(false),
  options: text("options").array().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkLogs = pgTable("check_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  typeId: integer("type_id")
    .notNull()
    .references(() => checkLogTypes.id, { onDelete: "cascade" }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
  valueMilli: integer("value_milli"),
  valueLabels: text("value_labels").array().notNull().default([]),
  valueText: text("value_text").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkLogPhotos = pgTable("check_log_photos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  logId: integer("log_id")
    .notNull()
    .references(() => checkLogs.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bowls = pgTable("bowls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bowlReadings = pgTable("bowl_readings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bowlId: integer("bowl_id")
    .notNull()
    .references(() => bowls.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull(),
  kind: text("kind").notNull().default("weigh"),
  weightGrams: integer("weight_grams").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const medicationLogs = pgTable("medication_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  treatmentId: integer("treatment_id").references(() => treatments.id, { onDelete: "set null" }),
  drugId: integer("drug_id").references(() => drugs.id, { onDelete: "set null" }),
  givenAt: timestamp("given_at", { withTimezone: true }).notNull(),
  slot: text("slot"),
  amountMilliUnits: integer("amount_milli_units"),
  stockDeductedMilliUnits: integer("stock_deducted_milli_units").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEntries = pgTable("calendar_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  rabbitId: integer("rabbit_id").references(() => rabbits.id, { onDelete: "set null" }),
  repeat: text("repeat").notNull().default("none"),
  repeatUntil: date("repeat_until"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rabbitBonds = pgTable(
  "rabbit_bonds",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    rabbitId: integer("rabbit_id")
      .notNull()
      .references(() => rabbits.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => rabbits.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("rabbit_bonds_pair_unique").on(table.rabbitId, table.partnerId)],
);

export const rabbitCarers = pgTable(
  "rabbit_carers",
  {
    rabbitId: integer("rabbit_id")
      .notNull()
      .references(() => rabbits.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.rabbitId, table.userId] })],
);

export const healthChecks = pgTable("health_checks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  weightGrams: integer("weight_grams"),
  appetite: text("appetite"),
  droppings: text("droppings"),
  energy: text("energy"),
  bodyCondition: integer("body_condition"),
  temperatureTenthsC: integer("temperature_tenths_c"),
  painScore: integer("pain_score"),
  checklist: jsonb("checklist").$type<HealthChecklistDto>(),
  notes: text("notes").notNull().default(""),
  hasPhoto: boolean("has_photo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drugs = pgTable("drugs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  activeIngredient: text("active_ingredient").notNull().default(""),
  form: text("form").notNull().default("liquid"),
  unit: text("unit").notNull().default("ml"),
  concentrationMicrogramsPerUnit: integer("concentration_micrograms_per_unit"),
  doseMicrogramsPerKg: integer("dose_micrograms_per_kg"),
  dosesPerDay: integer("doses_per_day").notNull().default(1),
  route: text("route").notNull().default(""),
  frequency: text("frequency").notNull().default(""),
  durationDays: integer("duration_days"),
  howToUse: text("how_to_use").notNull().default(""),
  warnings: text("warnings").notNull().default(""),
  reorderLevelMilliUnits: integer("reorder_level_milli_units").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drugBatches = pgTable("drug_batches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  drugId: integer("drug_id")
    .notNull()
    .references(() => drugs.id, { onDelete: "cascade" }),
  quantityMilliUnits: integer("quantity_milli_units").notNull().default(0),
  expiryDate: date("expiry_date"),
  batch: text("batch").notNull().default(""),
  supplier: text("supplier").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const treatments = pgTable("treatments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  medication: text("medication").notNull(),
  dose: text("dose").notNull().default(""),
  route: text("route").notNull().default(""),
  frequency: text("frequency").notNull().default(""),
  slots: text("slots").array().notNull().default([]),
  reason: text("reason").notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes").notNull().default(""),
  drugId: integer("drug_id").references(() => drugs.id, { onDelete: "set null" }),
  doseMilliUnits: integer("dose_milli_units"),
  stockDeductedMilliUnits: integer("stock_deducted_milli_units").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vaccinations = pgTable("vaccinations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  vaccine: text("vaccine").notNull(),
  givenAt: date("given_at").notNull(),
  nextDueAt: date("next_due_at"),
  vet: text("vet").notNull().default(""),
  batch: text("batch").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careSchedules = pgTable(
  "care_schedules",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    rabbitId: integer("rabbit_id")
      .notNull()
      .references(() => rabbits.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    intervalDays: integer("interval_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("care_schedules_rabbit_kind_unique").on(table.rabbitId, table.kind)],
);

export const careRecords = pgTable("care_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  doneAt: date("done_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rabbitTasks = pgTable("rabbit_tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  slot: text("slot").notNull().default("anytime"),
  intervalDays: integer("interval_days").notNull().default(1),
  notes: text("notes").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskCompletions = pgTable("task_completions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: integer("task_id")
    .notNull()
    .references(() => rabbitTasks.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  completedBy: integer("completed_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  clinic: text("clinic").notNull().default(""),
  vet: text("vet").notNull().default(""),
  location: text("location").notNull().default(""),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  costCents: integer("cost_cents"),
  followUpAt: timestamp("follow_up_at", { withTimezone: true }),
  eventUid: text("event_uid"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarSubscriptions = pgTable("calendar_subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => calendarSubscriptions.id, { onDelete: "cascade" }),
    uid: text("uid").notNull(),
    summary: text("summary").notNull().default(""),
    location: text("location").notNull().default(""),
    description: text("description").notNull().default(""),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("calendar_events_subscription_uid_unique").on(table.subscriptionId, table.uid)],
);

export const faqEntries = pgTable("faq_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  category: text("category").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clinics = pgTable("clinics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vets = pgTable("vets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "set null" }),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rabbitId: integer("rabbit_id")
    .notNull()
    .references(() => rabbits.id, { onDelete: "cascade" }),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalPhotos = pgTable("journal_photos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entryId: integer("entry_id")
    .notNull()
    .references(() => journalEntries.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lookups = pgTable(
  "lookups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    label: text("label").notNull(),
    defaultInt: integer("default_int"),
    defaultCents: integer("default_cents"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("lookups_kind_value_unique").on(table.kind, table.value)],
);

export const checklistSections = pgTable("checklist_sections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  hint: text("hint").notNull().default(""),
  multiple: boolean("multiple").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistOptions = pgTable(
  "checklist_options",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => checklistSections.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [unique("checklist_options_section_value_unique").on(table.sectionId, table.value)],
);

export const checklistPhotos = pgTable("checklist_photos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => checklistSections.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SettingsRow = typeof settings.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type RabbitRow = typeof rabbits.$inferSelect;
export type RabbitBondRow = typeof rabbitBonds.$inferSelect;
export type RabbitCarerRow = typeof rabbitCarers.$inferSelect;
export type HealthCheckRow = typeof healthChecks.$inferSelect;
export type TreatmentRow = typeof treatments.$inferSelect;
export type VaccinationRow = typeof vaccinations.$inferSelect;
export type CareScheduleRow = typeof careSchedules.$inferSelect;
export type CareRecordRow = typeof careRecords.$inferSelect;
export type RabbitTaskRow = typeof rabbitTasks.$inferSelect;
export type TaskCompletionRow = typeof taskCompletions.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;
export type CalendarSubscriptionRow = typeof calendarSubscriptions.$inferSelect;
export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type FaqEntryRow = typeof faqEntries.$inferSelect;
export type ClinicRow = typeof clinics.$inferSelect;
export type VetRow = typeof vets.$inferSelect;
export type LookupRow = typeof lookups.$inferSelect;
export type CheckLogTypeRow = typeof checkLogTypes.$inferSelect;
export type CheckLogRow = typeof checkLogs.$inferSelect;
export type CheckLogPhotoRow = typeof checkLogPhotos.$inferSelect;
export type BowlRow = typeof bowls.$inferSelect;
export type BowlReadingRow = typeof bowlReadings.$inferSelect;
export type MedicationLogRow = typeof medicationLogs.$inferSelect;
export type CalendarEntryRow = typeof calendarEntries.$inferSelect;
export type JournalEntryRow = typeof journalEntries.$inferSelect;
export type JournalPhotoRow = typeof journalPhotos.$inferSelect;
export type ChecklistSectionRow = typeof checklistSections.$inferSelect;
export type ChecklistOptionRow = typeof checklistOptions.$inferSelect;
export type ChecklistPhotoRow = typeof checklistPhotos.$inferSelect;
export type DrugRow = typeof drugs.$inferSelect;
export type DrugBatchRow = typeof drugBatches.$inferSelect;
