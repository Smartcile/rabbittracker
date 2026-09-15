import { asc, desc, eq, inArray, max } from "drizzle-orm";
import type { ReportBundleDto } from "../../../shared/types.ts";
import {
  appointmentToDto,
  bowlToDto,
  careRecordToDto,
  careScheduleToDto,
  checkLogToDto,
  checkLogTypeToDto,
  drugToDto,
  growthStageToDto,
  healthCheckToDto,
  journalEntryToDto,
  lookupToDto,
  medicationLogToDto,
  rabbitToDto,
  stageCompletionToDto,
  taskCompletionToDto,
  taskToDto,
  treatmentToDto,
  userToDto,
  vaccinationToDto,
} from "../api/mappers.ts";
import { db } from "../db/index.ts";
import {
  bowlReadings,
  bowls,
  checkLogPhotos,
  checkLogs,
  drugs,
  growthStages,
  medicationLogs,
  rabbitBonds,
  rabbitCarers,
  rabbitStageCompletions,
  rabbits,
  rabbitTasks,
  taskCompletions,
  users,
} from "../db/schema.ts";
import type { TaskCompletionRow, UserRow } from "../db/schema.ts";
import { listCheckLogTypes } from "../lib/checkLogStore.ts";
import { listChecklistConfig } from "../lib/checklistStore.ts";
import { listLookups } from "../lib/lookupStore.ts";
import { getSettings } from "../lib/settingsStore.ts";
import { listAppointmentsForRabbit } from "../routes/appointments.ts";
import { listRecordsForRabbit, listSchedulesForRabbit } from "../routes/care.ts";
import { listChecksForRabbit } from "../routes/checks.ts";
import { listJournalForRabbit } from "../routes/journal.ts";
import { listTreatmentsForRabbit } from "../routes/treatments.ts";
import { listVaccinationsForRabbit } from "../routes/vaccinations.ts";

export type ReportBundleOptions = {
  hideCosts: boolean;
  includeCarers: boolean;
};

export async function buildReportBundle(
  rabbitId: number,
  options: ReportBundleOptions,
): Promise<ReportBundleDto | null> {
  const rabbitRows = await db.select().from(rabbits).where(eq(rabbits.id, rabbitId)).limit(1);
  const rabbit = rabbitRows[0];
  if (!rabbit) return null;

  const [
    checks,
    treatments,
    vaccinations,
    schedules,
    records,
    appointmentRows,
    journalRows,
    bondRows,
    carerRows,
    logRows,
    logTypes,
    medRows,
    bowlRows,
    taskRows,
    stageRows,
    stageConfig,
    checklist,
    careTypeRows,
    drugRows,
    settings,
  ] = await Promise.all([
    listChecksForRabbit(rabbitId),
    listTreatmentsForRabbit(rabbitId),
    listVaccinationsForRabbit(rabbitId),
    listSchedulesForRabbit(rabbitId),
    listRecordsForRabbit(rabbitId),
    listAppointmentsForRabbit(rabbitId),
    listJournalForRabbit(rabbitId),
    db
      .select({ rabbit: rabbits })
      .from(rabbitBonds)
      .innerJoin(rabbits, eq(rabbitBonds.partnerId, rabbits.id))
      .where(eq(rabbitBonds.rabbitId, rabbitId))
      .orderBy(asc(rabbits.name)),
    options.includeCarers
      ? db
          .select({ user: users })
          .from(rabbitCarers)
          .innerJoin(users, eq(rabbitCarers.userId, users.id))
          .where(eq(rabbitCarers.rabbitId, rabbitId))
          .orderBy(asc(users.displayName))
      : Promise.resolve([] as { user: UserRow }[]),
    db
      .select()
      .from(checkLogs)
      .where(eq(checkLogs.rabbitId, rabbitId))
      .orderBy(desc(checkLogs.loggedAt))
      .limit(500),
    listCheckLogTypes(),
    db
      .select()
      .from(medicationLogs)
      .where(eq(medicationLogs.rabbitId, rabbitId))
      .orderBy(desc(medicationLogs.givenAt))
      .limit(500),
    db.select().from(bowls).where(eq(bowls.rabbitId, rabbitId)).orderBy(asc(bowls.id)),
    db.select().from(rabbitTasks).where(eq(rabbitTasks.rabbitId, rabbitId)).orderBy(asc(rabbitTasks.id)),
    db
      .select()
      .from(rabbitStageCompletions)
      .where(eq(rabbitStageCompletions.rabbitId, rabbitId))
      .orderBy(asc(rabbitStageCompletions.completedAt)),
    db.select().from(growthStages).orderBy(asc(growthStages.sortOrder), asc(growthStages.id)),
    listChecklistConfig(),
    listLookups("care_type"),
    db.select().from(drugs).orderBy(asc(drugs.name)),
    getSettings(),
  ]);

  const logPhotos = logRows.length
    ? await db
        .select()
        .from(checkLogPhotos)
        .where(inArray(checkLogPhotos.logId, logRows.map((row) => row.id)))
        .orderBy(asc(checkLogPhotos.sortOrder), asc(checkLogPhotos.id))
    : [];
  const typeById = new Map(logTypes.map((type) => [type.id, type]));

  const readings = bowlRows.length
    ? await db
        .select()
        .from(bowlReadings)
        .where(inArray(bowlReadings.bowlId, bowlRows.map((row) => row.id)))
        .orderBy(asc(bowlReadings.readAt), asc(bowlReadings.id))
    : [];

  const taskIds = taskRows.map((row) => row.id);
  const [lastRows, completionRows] = taskIds.length
    ? await Promise.all([
        db
          .select({ taskId: taskCompletions.taskId, last: max(taskCompletions.completedAt) })
          .from(taskCompletions)
          .where(inArray(taskCompletions.taskId, taskIds))
          .groupBy(taskCompletions.taskId),
        db
          .select()
          .from(taskCompletions)
          .where(inArray(taskCompletions.taskId, taskIds))
          .orderBy(desc(taskCompletions.completedAt), desc(taskCompletions.id))
          .limit(100),
      ])
    : [[] as { taskId: number; last: Date | null }[], [] as TaskCompletionRow[]];
  const lastByTask = new Map(lastRows.map((row) => [row.taskId, row.last]));

  return {
    timezone: settings.timezone,
    rabbit: rabbitToDto(rabbit),
    bonds: bondRows.map((row) => rabbitToDto(row.rabbit)),
    carers: carerRows.map((row) => userToDto(row.user)),
    checks: checks.map(healthCheckToDto),
    treatments: treatments.map(treatmentToDto),
    vaccinations: vaccinations.map(vaccinationToDto),
    careSchedules: schedules.map(careScheduleToDto),
    careRecords: records.map(careRecordToDto),
    appointments: appointmentRows.map((row) => appointmentToDto(row, options.hideCosts)),
    journal: journalRows.map((item) => journalEntryToDto(item.entry, item.photos)),
    checkLogs: logRows.map((row) =>
      checkLogToDto(
        row,
        typeById.get(row.typeId),
        logPhotos.filter((photo) => photo.logId === row.id),
      ),
    ),
    medicationLogs: medRows.map(medicationLogToDto),
    bowls: bowlRows.map((bowl) =>
      bowlToDto(
        bowl,
        readings.filter((reading) => reading.bowlId === bowl.id),
      ),
    ),
    tasks: taskRows.map((row) => taskToDto(row, lastByTask.get(row.id) ?? null)),
    taskCompletions: completionRows.map((row) => taskCompletionToDto(row, rabbitId)),
    growthStages: stageConfig.map(growthStageToDto),
    stageCompletions: stageRows.map((row) => stageCompletionToDto(row, rabbitId)),
    drugs: drugRows.map((row) => drugToDto(row, [])),
    checklist,
    logTypes: logTypes.map(checkLogTypeToDto),
    careTypes: careTypeRows.map(lookupToDto),
  };
}
