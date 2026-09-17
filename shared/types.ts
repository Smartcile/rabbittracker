import type { DrugForm } from "./drugs.ts";
import type { HealthChecklistDto } from "./checklist.ts";
import type { Recurrence } from "./recurrence.ts";
import type { DaySlot } from "./slots.ts";

export type UserDto = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  active: boolean;
  hasPin: boolean;
  canCreateRabbits: boolean;
  canRecordHealth: boolean;
  canEditRabbits: boolean;
  canViewCosts: boolean;
  canManageCalendar: boolean;
  canEditFaq: boolean;
  createdAt: string;
};

export type AuthMeDto = {
  user: UserDto | null;
  needsSetup: boolean;
  idleMinutes: number;
  pinLogin: boolean;
};

export type SettingsDto = {
  timezone: string;
  feedToken: string;
  shareToken: string;
  demoMode: boolean;
  foodMinGramsPerKg: number;
  foodMaxGramsPerKg: number;
  waterMinMilliLitresPerKg: number;
  waterMaxMilliLitresPerKg: number;
};

export type BreedNormDto = {
  id: number;
  breed: string;
  minGrams: number;
  maxGrams: number;
};

export type GrowthStageDto = {
  id: number;
  label: string;
  guidance: string;
  startDays: number;
  endDays: number;
  sex: "any" | "male" | "female";
  sortOrder: number;
};

export type RabbitStageCompletionDto = {
  id: number;
  rabbitId: number;
  stageId: number;
  completedAt: string;
  notes: string;
};

export type CalendarSubscriptionDto = {
  id: number;
  label: string;
  url: string;
  lastSyncAt: string | null;
  syncError: string | null;
};

export type RabbitSex = "male" | "female" | "unknown";
export type RabbitStatus = "active" | "deceased";

export type RabbitDto = {
  id: number;
  name: string;
  sex: RabbitSex;
  breed: string;
  colour: string;
  dateOfBirth: string | null;
  desexed: boolean;
  microchip: string;
  notes: string;
  status: RabbitStatus;
  hasAvatar: boolean;
  quarantined: boolean;
  quarantineUntil: string | null;
  targetWeightMinGrams: number | null;
  targetWeightMaxGrams: number | null;
  feedingPlan: string;
  deceasedAt: string | null;
  deceasedReason: string;
  createdAt: string;
  updatedAt: string;
};

export type Appetite = "normal" | "reduced" | "none";
export type Droppings = "normal" | "small" | "few" | "none";
export type Energy = "normal" | "low" | "high";
export type WeightAlert = "ok" | "watch" | "alert";

export type HealthCheckDto = {
  id: number;
  rabbitId: number;
  checkedAt: string;
  weightGrams: number | null;
  appetite: Appetite | null;
  droppings: Droppings | null;
  energy: Energy | null;
  bodyCondition: number | null;
  temperatureTenthsC: number | null;
  painScore: number | null;
  checklist: HealthChecklistDto;
  notes: string;
  hasPhoto: boolean;
  createdAt: string;
};

export type RabbitSummaryDto = RabbitDto & {
  latestWeightGrams: number | null;
  weightChangeGrams: number | null;
  weightAlert: WeightAlert | null;
  badges: AttentionBadgeDto[];
};

export type TreatmentStatus = "active" | "completed" | "stopped";

export type TreatmentDto = {
  id: number;
  rabbitId: number;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  slots: DaySlot[];
  recurrence: Recurrence;
  reason: string;
  startDate: string;
  endDate: string | null;
  status: TreatmentStatus;
  notes: string;
  drugId: number | null;
  doseMilliUnits: number | null;
  stockDeductedMilliUnits: number;
  createdAt: string;
  updatedAt: string;
};

export type DrugBatchDto = {
  id: number;
  drugId: number;
  quantityMilliUnits: number;
  expiryDate: string | null;
  batch: string;
  supplier: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type DrugDto = {
  id: number;
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
  batches: DrugBatchDto[];
  createdAt: string;
  updatedAt: string;
};

export type { DrugForm };

export type Vaccine = string;

export type VaccinationDto = {
  id: number;
  rabbitId: number;
  vaccine: Vaccine;
  givenAt: string;
  nextDueAt: string | null;
  vet: string;
  batch: string;
  notes: string;
  createdAt: string;
};

export type AttentionBadgeDto = {
  kind: "weight" | "vaccination" | "care" | "follow-up";
  label: string;
  severity: "watch" | "alert";
};

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export type AppointmentDto = {
  id: number;
  rabbitId: number;
  title: string;
  clinic: string;
  vet: string;
  location: string;
  scheduledAt: string;
  status: AppointmentStatus;
  costCents: number | null;
  followUpAt: string | null;
  eventUid: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventDto = {
  id: number;
  uid: string;
  summary: string;
  location: string;
  description: string;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  createdAt: string;
};

export type CalendarSyncResultDto = {
  added: number;
  updated: number;
  removed: number;
  total: number;
};

export type FaqEntryDto = {
  id: number;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type FaqGroupDto = {
  category: string;
  entries: FaqEntryDto[];
};

export type CheckLogTypeDto = {
  id: number;
  key: string;
  label: string;
  unit: string;
  hasNumber: boolean;
  hasText: boolean;
  multiple: boolean;
  options: string[];
  sortOrder: number;
};

export type CheckLogPhotoDto = {
  id: number;
  caption: string;
  sortOrder: number;
};

export type CheckLogDto = {
  id: number;
  rabbitId: number;
  typeId: number;
  typeLabel: string;
  typeUnit: string;
  loggedAt: string;
  valueMilli: number | null;
  valueLabels: string[];
  valueText: string;
  notes: string;
  photos: CheckLogPhotoDto[];
  createdAt: string;
};

export type BowlReadingKind = "start" | "weigh" | "consume" | "refill" | "refresh";

export type BowlReadingDto = {
  id: number;
  bowlId: number;
  readAt: string;
  kind: BowlReadingKind;
  slot: DaySlot | null;
  weightGrams: number;
  consumptionGrams: number;
  refillGrams: number;
  periodStart: boolean;
  notes: string;
  createdAt: string;
};

export type FoodStockEntryDto = {
  id: number;
  productId: number;
  amountGrams: number;
  note: string;
  createdAt: string;
};

export type FoodProductDto = {
  id: number;
  name: string;
  type: string;
  stockGrams: number;
  reorderLevelGrams: number;
  notes: string;
  entries: FoodStockEntryDto[];
  createdAt: string;
  updatedAt: string;
};

export type BowlDto = {
  id: number;
  rabbitId: number;
  label: string;
  kind: "food" | "water";
  slots: DaySlot[];
  recurrence: Recurrence;
  tareGrams: number | null;
  productIds: number[];
  currentWeightGrams: number | null;
  periodStartAt: string | null;
  startedAt: string | null;
  periodConsumptionGrams: number;
  periodRefillGrams: number;
  totalConsumptionGrams: number;
  totalRefillGrams: number;
  readings: BowlReadingDto[];
  createdAt: string;
  updatedAt: string;
};



export type TaskSlot = "morning" | "afternoon" | "evening" | "anytime";

export type TaskProductInput = {
  productId: number;
  amountGrams: number;
};

export type TaskProductDto = {
  productId: number;
  productName: string;
  amountGrams: number;
};

export type TaskDto = {
  id: number;
  rabbitId: number;
  label: string;
  careKind: string | null;
  slot: TaskSlot;
  intervalDays: number;
  recurrence: Recurrence;
  startDate: string | null;
  products: TaskProductDto[];
  notes: string;
  active: boolean;
  lastCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplateDto = {
  id: number;
  label: string;
  slot: TaskSlot;
  intervalDays: number;
  recurrence: Recurrence;
  startDate: string | null;
  products: TaskProductDto[];
  notes: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskCompletionDto = {
  id: number;
  taskId: number;
  rabbitId: number;
  completedAt: string;
  completedBy: number | null;
  notes: string;
  createdAt: string;
};

export type MedicationLogDto = {
  id: number;
  rabbitId: number;
  treatmentId: number | null;
  drugId: number | null;
  givenAt: string;
  slot: DaySlot | null;
  skipped: boolean;
  amountMilliUnits: number | null;
  notes: string;
  createdAt: string;
};

export type CalendarRepeat = "none" | "daily" | "weekly" | "monthly";

export type CalendarEntryDto = {
  id: number;
  title: string;
  type: string;
  startAt: string;
  allDay: boolean;
  location: string;
  notes: string;
  rabbitId: number | null;
  repeat: CalendarRepeat;
  repeatUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VetDto = {
  id: number;
  name: string;
  clinicId: number | null;
  clinic: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClinicDto = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LookupDto = {
  id: number;
  kind: string;
  value: string;
  label: string;
  defaultInt: number | null;
  defaultCents: number | null;
};

export type JournalPhotoDto = {
  id: number;
  caption: string;
};

export type JournalEntryDto = {
  id: number;
  rabbitId: number;
  note: string;
  photos: JournalPhotoDto[];
  createdAt: string;
  updatedAt: string;
};

export type ChecklistOptionDto = {
  id: number;
  value: string;
  label: string;
};

export type ChecklistPhotoDto = {
  id: number;
  caption: string;
};

export type ChecklistSectionDto = {
  id: number;
  key: string;
  label: string;
  hint: string;
  multiple: boolean;
  unit: string;
  hasNumber: boolean;
  hasText: boolean;
  options: ChecklistOptionDto[];
  photos: ChecklistPhotoDto[];
};

export type ChecklistDto = {
  id: number;
  key: string;
  label: string;
  isDaily: boolean;
  recurrence: Recurrence;
  sortOrder: number;
  itemCount: number;
};

export type ChecklistItemDto = {
  id: number;
  kind: "section" | "type";
  sectionId: number | null;
  typeId: number | null;
  label: string;
  sortOrder: number;
};

export type ReportBundleDto = {
  timezone: string;
  rabbit: RabbitDto;
  bonds: RabbitDto[];
  carers: UserDto[];
  checks: HealthCheckDto[];
  treatments: TreatmentDto[];
  vaccinations: VaccinationDto[];
  appointments: AppointmentDto[];
  journal: JournalEntryDto[];
  checkLogs: CheckLogDto[];
  medicationLogs: MedicationLogDto[];
  bowls: BowlDto[];
  tasks: TaskDto[];
  taskCompletions: TaskCompletionDto[];
  growthStages: GrowthStageDto[];
  stageCompletions: RabbitStageCompletionDto[];
  drugs: DrugDto[];
  checklist: ChecklistSectionDto[];
  logTypes: CheckLogTypeDto[];
  careTypes: LookupDto[];
};
