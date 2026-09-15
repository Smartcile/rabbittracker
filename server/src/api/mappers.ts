import type {
  Appetite,
  AppointmentDto,
  AppointmentStatus,
  BowlDto,
  BowlReadingKind,
  BreedNormDto,
  CalendarEntryDto,
  CalendarEventDto,
  CalendarRepeat,
  CalendarSubscriptionDto,
  CheckLogDto,
  CheckLogTypeDto,
  CareKind,
  CareRecordDto,
  CareScheduleDto,
  ChecklistSectionDto,
  ClinicDto,
  Droppings,
  DrugBatchDto,
  DrugDto,
  FoodProductDto,
  FoodStockEntryDto,
  LookupDto,
  MedicationLogDto,
  Energy,
  FaqEntryDto,
  FaqGroupDto,
  GrowthStageDto,
  HealthCheckDto,
  JournalEntryDto,
  RabbitDto,
  RabbitSex,
  RabbitStageCompletionDto,
  RabbitStatus,
  SettingsDto,
  TaskCompletionDto,
  TaskDto,
  TaskSlot,
  TreatmentDto,
  TreatmentStatus,
  UserDto,
  Vaccine,
  VaccinationDto,
  VetDto,
} from "../../../shared/types.ts";
import type { DrugForm } from "../../../shared/drugs.ts";
import { summarizeBowl } from "../../../shared/bowls.ts";
import { emptyChecklist } from "../../../shared/checklist.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import { DAY_SLOTS } from "../../../shared/slots.ts";
import type {
  AppointmentRow,
  BowlReadingRow,
  BowlRow,
  BreedNormRow,
  CalendarEntryRow,
  CalendarEventRow,
  CalendarSubscriptionRow,
  CareRecordRow,
  CareScheduleRow,
  CheckLogPhotoRow,
  CheckLogRow,
  CheckLogTypeRow,
  ChecklistOptionRow,
  ChecklistPhotoRow,
  ChecklistSectionRow,
  ClinicRow,
  DrugBatchRow,
  DrugRow,
  FoodProductRow,
  FoodStockEntryRow,
  GrowthStageRow,
  MedicationLogRow,
  FaqEntryRow,
  HealthCheckRow,
  JournalEntryRow,
  JournalPhotoRow,
  LookupRow,
  RabbitRow,
  RabbitStageCompletionRow,
  RabbitTaskRow,
  SettingsRow,
  TaskCompletionRow,
  TreatmentRow,
  UserRow,
  VaccinationRow,
  VetRow,
} from "../db/schema.ts";

export function userToDto(row: UserRow): UserDto {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    isAdmin: row.isAdmin,
    active: row.active,
    hasPin: row.pinHash !== null,
    canCreateRabbits: row.canCreateRabbits,
    canRecordHealth: row.canRecordHealth,
    canEditRabbits: row.canEditRabbits,
    canViewCosts: row.canViewCosts,
    canManageCalendar: row.canManageCalendar,
    canEditFaq: row.canEditFaq,
    createdAt: row.createdAt.toISOString(),
  };
}

export function settingsToDto(row: SettingsRow): SettingsDto {
  return {
    timezone: row.timezone,
    feedToken: row.feedToken,
    shareToken: row.shareToken,
    demoMode: row.demoMode,
    foodMinGramsPerKg: row.foodMinGramsPerKg,
    foodMaxGramsPerKg: row.foodMaxGramsPerKg,
    waterMinMilliLitresPerKg: row.waterMinMilliLitresPerKg,
    waterMaxMilliLitresPerKg: row.waterMaxMilliLitresPerKg,
  };
}

export function breedNormToDto(row: BreedNormRow): BreedNormDto {
  return {
    id: row.id,
    breed: row.breed,
    minGrams: row.minGrams,
    maxGrams: row.maxGrams,
  };
}

export function growthStageToDto(row: GrowthStageRow): GrowthStageDto {
  return {
    id: row.id,
    label: row.label,
    guidance: row.guidance,
    startDays: row.startDays,
    endDays: row.endDays,
    sex: row.sex === "male" || row.sex === "female" ? row.sex : "any",
    sortOrder: row.sortOrder,
  };
}

export function stageCompletionToDto(
  row: RabbitStageCompletionRow,
  rabbitId: number,
): RabbitStageCompletionDto {
  return {
    id: row.id,
    rabbitId,
    stageId: row.stageId,
    completedAt: row.completedAt,
    notes: row.notes,
  };
}

export function calendarSubscriptionToDto(row: CalendarSubscriptionRow): CalendarSubscriptionDto {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    syncError: row.syncError,
  };
}

export function rabbitToDto(row: RabbitRow): RabbitDto {
  return {
    id: row.id,
    name: row.name,
    sex: row.sex as RabbitSex,
    breed: row.breed,
    colour: row.colour,
    dateOfBirth: row.dateOfBirth,
    desexed: row.desexed,
    microchip: row.microchip,
    notes: row.notes,
    status: row.status as RabbitStatus,
    hasAvatar: row.hasAvatar,
    quarantined: row.quarantined,
    quarantineUntil: row.quarantineUntil,
    targetWeightMinGrams: row.targetWeightMinGrams,
    targetWeightMaxGrams: row.targetWeightMaxGrams,
    feedingPlan: row.feedingPlan,
    deceasedAt: row.deceasedAt,
    deceasedReason: row.deceasedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function healthCheckToDto(row: HealthCheckRow): HealthCheckDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    checkedAt: row.checkedAt.toISOString(),
    weightGrams: row.weightGrams,
    appetite: row.appetite as Appetite | null,
    droppings: row.droppings as Droppings | null,
    energy: row.energy as Energy | null,
    bodyCondition: row.bodyCondition,
    temperatureTenthsC: row.temperatureTenthsC,
    painScore: row.painScore,
    checklist: row.checklist ?? emptyChecklist(),
    notes: row.notes,
    hasPhoto: row.hasPhoto,
    createdAt: row.createdAt.toISOString(),
  };
}

export function treatmentToDto(row: TreatmentRow): TreatmentDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    medication: row.medication,
    dose: row.dose,
    route: row.route,
    frequency: row.frequency,
    slots: daySlots(row.slots),
    reason: row.reason,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as TreatmentStatus,
    notes: row.notes,
    drugId: row.drugId,
    doseMilliUnits: row.doseMilliUnits,
    stockDeductedMilliUnits: row.stockDeductedMilliUnits,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function drugBatchToDto(row: DrugBatchRow): DrugBatchDto {
  return {
    id: row.id,
    drugId: row.drugId,
    quantityMilliUnits: row.quantityMilliUnits,
    expiryDate: row.expiryDate,
    batch: row.batch,
    supplier: row.supplier,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function drugToDto(row: DrugRow, batches: DrugBatchRow[]): DrugDto {
  return {
    id: row.id,
    name: row.name,
    activeIngredient: row.activeIngredient,
    form: row.form as DrugForm,
    unit: row.unit,
    concentrationMicrogramsPerUnit: row.concentrationMicrogramsPerUnit,
    doseMicrogramsPerKg: row.doseMicrogramsPerKg,
    dosesPerDay: row.dosesPerDay,
    route: row.route,
    frequency: row.frequency,
    durationDays: row.durationDays,
    howToUse: row.howToUse,
    warnings: row.warnings,
    reorderLevelMilliUnits: row.reorderLevelMilliUnits,
    batches: batches.map(drugBatchToDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function vaccinationToDto(row: VaccinationRow): VaccinationDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    vaccine: row.vaccine as Vaccine,
    givenAt: row.givenAt,
    nextDueAt: row.nextDueAt,
    vet: row.vet,
    batch: row.batch,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function careScheduleToDto(row: CareScheduleRow): CareScheduleDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    kind: row.kind as CareKind,
    intervalDays: row.intervalDays,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function careRecordToDto(row: CareRecordRow): CareRecordDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    kind: row.kind as CareKind,
    doneAt: row.doneAt,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function appointmentToDto(row: AppointmentRow, hideCosts = false): AppointmentDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    title: row.title,
    clinic: row.clinic,
    vet: row.vet,
    location: row.location,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status as AppointmentStatus,
    costCents: hideCosts ? null : row.costCents,
    followUpAt: row.followUpAt ? row.followUpAt.toISOString() : null,
    eventUid: row.eventUid,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function calendarEventToDto(row: CalendarEventRow): CalendarEventDto {
  return {
    id: row.id,
    uid: row.uid,
    summary: row.summary,
    location: row.location,
    description: row.description,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    allDay: row.allDay,
    createdAt: row.createdAt.toISOString(),
  };
}

export function faqEntryToDto(row: FaqEntryRow): FaqEntryDto {
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function checkLogTypeToDto(row: CheckLogTypeRow): CheckLogTypeDto {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    unit: row.unit,
    hasNumber: row.hasNumber,
    hasText: row.hasText,
    multiple: row.multiple,
    options: row.options,
    sortOrder: row.sortOrder,
  };
}

export function checkLogToDto(
  row: CheckLogRow,
  type?: CheckLogTypeRow,
  photos: CheckLogPhotoRow[] = [],
): CheckLogDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    typeId: row.typeId,
    typeLabel: type?.label ?? "Check",
    typeUnit: type?.unit ?? "",
    loggedAt: row.loggedAt.toISOString(),
    valueMilli: row.valueMilli,
    valueLabels: row.valueLabels,
    valueText: row.valueText,
    notes: row.notes,
    photos: photos.map((photo) => ({
      id: photo.id,
      caption: photo.caption,
      sortOrder: photo.sortOrder,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export function bowlToDto(row: BowlRow, readings: BowlReadingRow[]): BowlDto {
  const summary = summarizeBowl(readings);
  const computedById = new Map(summary.readings.map((item) => [item.id, item]));
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    label: row.label,
    kind: row.kind === "water" ? "water" : "food",
    slots: daySlots(row.slots),
    tareGrams: row.tareGrams,
    productId: row.productId,
    currentWeightGrams: summary.currentWeightGrams,
    periodStartAt: summary.periodStartAt ? summary.periodStartAt.toISOString() : null,
    periodConsumptionGrams: summary.periodConsumptionGrams,
    periodRefillGrams: summary.periodRefillGrams,
    totalConsumptionGrams: summary.totalConsumptionGrams,
    totalRefillGrams: summary.totalRefillGrams,
    readings: [...readings]
      .sort((a, b) => b.readAt.getTime() - a.readAt.getTime() || b.id - a.id)
      .map((reading) => {
        const computed = computedById.get(reading.id);
        return {
          id: reading.id,
          bowlId: reading.bowlId,
          readAt: reading.readAt.toISOString(),
          kind: bowlReadingKind(reading.kind),
          slot: daySlot(reading.slot),
          weightGrams: reading.weightGrams,
          consumptionGrams: computed?.consumptionGrams ?? 0,
          refillGrams: computed?.refillGrams ?? 0,
          periodStart: computed?.periodStart ?? false,
          notes: reading.notes,
          createdAt: reading.createdAt.toISOString(),
        };
      }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function bowlReadingKind(value: string): BowlReadingKind {
  return value === "start" || value === "consume" || value === "refill" || value === "refresh"
    ? value
    : "weigh";
}

export function foodStockEntryToDto(row: FoodStockEntryRow): FoodStockEntryDto {
  return {
    id: row.id,
    productId: row.productId,
    amountGrams: row.amountGrams,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function foodProductToDto(
  row: FoodProductRow,
  entries: FoodStockEntryRow[],
): FoodProductDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    stockGrams: entries.reduce((sum, entry) => sum + entry.amountGrams, 0),
    reorderLevelGrams: row.reorderLevelGrams,
    notes: row.notes,
    entries: entries.map(foodStockEntryToDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function taskToDto(row: RabbitTaskRow, lastCompletedAt: Date | null): TaskDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    label: row.label,
    slot: taskSlot(row.slot),
    intervalDays: row.intervalDays,
    notes: row.notes,
    active: row.active,
    lastCompletedAt: lastCompletedAt ? lastCompletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function taskCompletionToDto(row: TaskCompletionRow, rabbitId: number): TaskCompletionDto {
  return {
    id: row.id,
    taskId: row.taskId,
    rabbitId,
    completedAt: row.completedAt.toISOString(),
    completedBy: row.completedBy,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function taskSlot(value: string): TaskSlot {
  return value === "morning" || value === "afternoon" || value === "evening" ? value : "anytime";
}

function daySlot(value: string | null): DaySlot | null {
  return (DAY_SLOTS as readonly string[]).includes(value ?? "")
    ? (value as DaySlot)
    : null;
}

function daySlots(values: string[]): DaySlot[] {
  return values.filter((value): value is DaySlot => daySlot(value) !== null);
}

export function medicationLogToDto(row: MedicationLogRow): MedicationLogDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    treatmentId: row.treatmentId,
    drugId: row.drugId,
    givenAt: row.givenAt.toISOString(),
    slot: daySlot(row.slot),
    skipped: row.skipped,
    amountMilliUnits: row.amountMilliUnits,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function calendarEntryToDto(row: CalendarEntryRow): CalendarEntryDto {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    startAt: row.startAt.toISOString(),
    allDay: row.allDay,
    location: row.location,
    notes: row.notes,
    rabbitId: row.rabbitId,
    repeat: row.repeat as CalendarRepeat,
    repeatUntil: row.repeatUntil,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function clinicToDto(row: ClinicRow): ClinicDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function vetToDto(row: VetRow, clinicName = ""): VetDto {
  return {
    id: row.id,
    name: row.name,
    clinicId: row.clinicId,
    clinic: clinicName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function lookupToDto(row: LookupRow): LookupDto {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    label: row.label,
    defaultInt: row.defaultInt,
    defaultCents: row.defaultCents,
  };
}

export function journalEntryToDto(row: JournalEntryRow, photos: JournalPhotoRow[]): JournalEntryDto {
  return {
    id: row.id,
    rabbitId: row.rabbitId,
    note: row.note,
    photos: photos.map((photo) => ({ id: photo.id, caption: photo.caption })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function checklistSectionToDto(
  row: ChecklistSectionRow,
  options: ChecklistOptionRow[],
  photos: ChecklistPhotoRow[],
): ChecklistSectionDto {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    hint: row.hint,
    multiple: row.multiple,
    options: options.map((option) => ({
      id: option.id,
      value: option.value,
      label: option.label,
    })),
    photos: photos.map((photo) => ({ id: photo.id, caption: photo.caption })),
  };
}

export function groupFaqEntries(rows: FaqEntryRow[]): FaqGroupDto[] {
  const sorted = [...rows].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder || a.id - b.id,
  );
  const groups = new Map<string, FaqEntryDto[]>();
  for (const row of sorted) {
    const list = groups.get(row.category) ?? [];
    list.push(faqEntryToDto(row));
    groups.set(row.category, list);
  }
  return [...groups.entries()].map(([category, entries]) => ({ category, entries }));
}
