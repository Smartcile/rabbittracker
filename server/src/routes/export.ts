import { asc, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { Router } from "express";
import type { Response } from "express";
import { join } from "node:path";
import { config } from "../config.ts";
import { db } from "../db/index.ts";
import { appointments, healthChecks, rabbits } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { getSettings } from "../lib/settingsStore.ts";
import { listPhotoFiles, writeBackupZip } from "../services/backupArchive.ts";
import { formatDateInZone, formatDateTimeInZone, toCsv } from "../services/csv.ts";

export const exportRouter = Router();

const BACKUP_EXCLUDED_TABLES = new Set(["sessions"]);

const BACKUP_REDACTED_COLUMNS: Record<string, string[]> = {
  users: ["passwordHash", "pinHash"],
};

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
  res.setHeader("Content-Disposition", 'attachment; filename="rabbittracker-backup.json"');
  res.json(await buildBackup());
});

exportRouter.get("/backup.zip", requireAuth, requireAdmin, async (_req, res) => {
  const backup = await buildBackup();
  const photos = await listPhotoFiles(join(config.dataDir, "photos"));
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="rabbittracker-backup.zip"');
  await writeBackupZip(res, JSON.stringify(backup, null, 2), photos);
  res.end();
});

async function buildBackup(): Promise<{
  exportedAt: string;
  version: number;
  tables: Record<string, Record<string, unknown>[]>;
}> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const { name, table } of backupTables()) {
    const primary = getTableConfig(table).columns.find((column) => column.primary);
    const query = db.select().from(table);
    const rows = primary ? await query.orderBy(asc(primary)) : await query;
    const redacted = BACKUP_REDACTED_COLUMNS[name] ?? [];
    tables[name] = rows.map((row) => {
      const record = { ...(row as Record<string, unknown>) };
      for (const column of redacted) delete record[column];
      return record;
    });
  }
  return { exportedAt: new Date().toISOString(), version: 2, tables };
}

function backupTables(): { name: string; table: PgTable }[] {
  const values: unknown[] = Object.values(schema);
  return values
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => ({ name: getTableConfig(table).name, table }))
    .filter(({ name }) => !BACKUP_EXCLUDED_TABLES.has(name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sendCsv(res: Response, filename: string, rows: (string | number | null)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(toCsv(rows));
}
