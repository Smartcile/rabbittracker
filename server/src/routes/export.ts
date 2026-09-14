import { Router } from "express";
import type { Response } from "express";
import {
  appointmentToDto,
  calendarEventToDto,
  careRecordToDto,
  careScheduleToDto,
  drugToDto,
  faqEntryToDto,
  healthCheckToDto,
  rabbitToDto,
  settingsToDto,
  treatmentToDto,
  userToDto,
  vaccinationToDto,
} from "../api/mappers.ts";
import { db } from "../db/index.ts";
import {
  appointments,
  calendarEvents,
  careRecords,
  careSchedules,
  drugBatches,
  drugs,
  faqEntries,
  healthChecks,
  rabbits,
  treatments,
  users,
  vaccinations,
} from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { getSettings } from "../lib/settingsStore.ts";
import { formatDateInZone, formatDateTimeInZone, toCsv } from "../services/csv.ts";

export const exportRouter = Router();

exportRouter.get("/checks.csv", requireAuth, requireAdmin, async (_req, res) => {
  const settings = await getSettings();
  const [checks, rabbitRows] = await Promise.all([
    db.select().from(healthChecks).orderBy(healthChecks.checkedAt),
    db.select().from(rabbits),
  ]);
  const names = new Map(rabbitRows.map((row) => [row.id, row.name]));
  const rows: (string | number | null)[][] = [
    ["Date", "Rabbit", "Weight (kg)", "Appetite", "Droppings", "Energy", "Condition (1-5)", "Notes"],
  ];
  for (const check of checks) {
    rows.push([
      formatDateInZone(check.checkedAt, settings.timezone),
      names.get(check.rabbitId) ?? "",
      check.weightGrams !== null ? (check.weightGrams / 1000).toFixed(2) : "",
      check.appetite ?? "",
      check.droppings ?? "",
      check.energy ?? "",
      check.bodyCondition ?? "",
      check.notes,
    ]);
  }
  sendCsv(res, "rabbit-checks.csv", rows);
});

exportRouter.get("/appointments.csv", requireAuth, requireAdmin, async (_req, res) => {
  const settings = await getSettings();
  const [appointmentRows, rabbitRows] = await Promise.all([
    db.select().from(appointments).orderBy(appointments.scheduledAt),
    db.select().from(rabbits),
  ]);
  const names = new Map(rabbitRows.map((row) => [row.id, row.name]));
  const rows: (string | number | null)[][] = [
    ["Date", "Rabbit", "Title", "Clinic", "Vet", "Location", "Cost", "Status", "Follow-up", "Notes"],
  ];
  for (const appointment of appointmentRows) {
    rows.push([
      formatDateTimeInZone(appointment.scheduledAt, settings.timezone),
      names.get(appointment.rabbitId) ?? "",
      appointment.title,
      appointment.clinic,
      appointment.vet,
      appointment.location,
      appointment.costCents !== null ? (appointment.costCents / 100).toFixed(2) : "",
      appointment.status,
      appointment.followUpAt ? formatDateTimeInZone(appointment.followUpAt, settings.timezone) : "",
      appointment.notes,
    ]);
  }
  sendCsv(res, "rabbit-appointments.csv", rows);
});

exportRouter.get("/backup.json", requireAuth, requireAdmin, async (_req, res) => {
  const [
    rabbitRows,
    checkRows,
    treatmentRows,
    vaccinationRows,
    scheduleRows,
    recordRows,
    appointmentRows,
    eventRows,
    faqRows,
    drugRows,
    batchRows,
    userRows,
    settingsRow,
  ] = await Promise.all([
    db.select().from(rabbits),
    db.select().from(healthChecks),
    db.select().from(treatments),
    db.select().from(vaccinations),
    db.select().from(careSchedules),
    db.select().from(careRecords),
    db.select().from(appointments),
    db.select().from(calendarEvents),
    db.select().from(faqEntries),
    db.select().from(drugs),
    db.select().from(drugBatches),
    db.select().from(users),
    getSettings(),
  ]);
  res.setHeader("Content-Disposition", 'attachment; filename="rabbittracker-backup.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    version: 1,
    rabbits: rabbitRows.map(rabbitToDto),
    checks: checkRows.map(healthCheckToDto),
    treatments: treatmentRows.map(treatmentToDto),
    vaccinations: vaccinationRows.map(vaccinationToDto),
    careSchedules: scheduleRows.map(careScheduleToDto),
    careRecords: recordRows.map(careRecordToDto),
    appointments: appointmentRows.map((row) => appointmentToDto(row)),
    calendarEvents: eventRows.map(calendarEventToDto),
    faqEntries: faqRows.map(faqEntryToDto),
    drugs: drugRows.map((row) =>
      drugToDto(
        row,
        batchRows.filter((batch) => batch.drugId === row.id),
      ),
    ),
    users: userRows.map(userToDto),
    settings: settingsToDto(settingsRow),
  });
});

function sendCsv(res: Response, filename: string, rows: (string | number | null)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(toCsv(rows));
}
