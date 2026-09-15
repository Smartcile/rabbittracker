import { asc, eq, inArray, isNotNull } from "drizzle-orm";
import { Router } from "express";
import {
  appointmentToDto,
  careRecordToDto,
  careScheduleToDto,
  healthCheckToDto,
  journalEntryToDto,
  rabbitToDto,
  stageCompletionToDto,
  treatmentToDto,
  userToDto,
  vaccinationToDto,
} from "../api/mappers.ts";
import { db } from "../db/index.ts";
import {
  appointments,
  careRecords,
  careSchedules,
  healthChecks,
  journalEntries,
  journalPhotos,
  rabbitBonds,
  rabbitCarers,
  rabbitStageCompletions,
  rabbits,
  users,
  vaccinations,
} from "../db/schema.ts";
import type { RabbitRow } from "../db/schema.ts";
import {
  findVisibleRabbit,
  hideCosts,
  requirePermission,
  visibleRabbitIds,
} from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  rabbitBondsPutSchema,
  rabbitCarersPutSchema,
  rabbitCreateSchema,
  rabbitUpdateSchema,
} from "../lib/validation.ts";
import { deletePhotoDir, savePhoto } from "../services/photos.ts";
import { buildReportBundle } from "../services/reportBundle.ts";
import { needsAttention, weightSummary } from "../../../shared/health.ts";
import type { AttentionBadgeDto, WeightAlert } from "../../../shared/types.ts";
import { listChecksForRabbit } from "./checks.ts";
import { listRecordsForRabbit, listSchedulesForRabbit } from "./care.ts";
import { listJournalForRabbit } from "./journal.ts";
import { listAppointmentsForRabbit } from "./appointments.ts";
import { photoUpload } from "./photos.ts";
import { listTreatmentsForRabbit } from "./treatments.ts";
import { listVaccinationsForRabbit } from "./vaccinations.ts";

export const rabbitsRouter = Router();

rabbitsRouter.get("/", requireAuth, async (req, res) => {
  const rows = req.user!.isAdmin
    ? await db.select().from(rabbits).orderBy(rabbits.name)
    : await db
        .select()
        .from(rabbits)
        .where(inArray(rabbits.id, visibleRabbitIds(req.user!)))
        .orderBy(rabbits.name);
  const [weightRows, vaccinationRows, scheduleRows, recordRows, followUpRows] = await Promise.all([
    db
      .select({
        rabbitId: healthChecks.rabbitId,
        checkedAt: healthChecks.checkedAt,
        weightGrams: healthChecks.weightGrams,
      })
      .from(healthChecks)
      .where(isNotNull(healthChecks.weightGrams))
      .orderBy(asc(healthChecks.checkedAt)),
    db
      .select({
        rabbitId: vaccinations.rabbitId,
        vaccine: vaccinations.vaccine,
        nextDueAt: vaccinations.nextDueAt,
      })
      .from(vaccinations),
    db
      .select({
        rabbitId: careSchedules.rabbitId,
        kind: careSchedules.kind,
        intervalDays: careSchedules.intervalDays,
      })
      .from(careSchedules),
    db
      .select({ rabbitId: careRecords.rabbitId, kind: careRecords.kind, doneAt: careRecords.doneAt })
      .from(careRecords),
    db
      .select({
        rabbitId: appointments.rabbitId,
        title: appointments.title,
        followUpAt: appointments.followUpAt,
      })
      .from(appointments)
      .where(isNotNull(appointments.followUpAt)),
  ]);

  const weightsByRabbit = new Map<number, { checkedAt: string; weightGrams: number }[]>();
  for (const row of weightRows) {
    if (row.weightGrams === null) continue;
    const list = weightsByRabbit.get(row.rabbitId) ?? [];
    list.push({ checkedAt: row.checkedAt.toISOString(), weightGrams: row.weightGrams });
    weightsByRabbit.set(row.rabbitId, list);
  }

  const vaccinationsByRabbit = new Map<number, { vaccine: string; nextDueAt: string | null }[]>();
  for (const row of vaccinationRows) {
    const list = vaccinationsByRabbit.get(row.rabbitId) ?? [];
    list.push({ vaccine: row.vaccine, nextDueAt: row.nextDueAt });
    vaccinationsByRabbit.set(row.rabbitId, list);
  }

  const schedulesByRabbit = new Map<number, { kind: string; intervalDays: number }[]>();
  for (const row of scheduleRows) {
    const list = schedulesByRabbit.get(row.rabbitId) ?? [];
    list.push({ kind: row.kind, intervalDays: row.intervalDays });
    schedulesByRabbit.set(row.rabbitId, list);
  }

  const lastCare = new Map<string, string>();
  for (const row of recordRows) {
    const key = `${row.rabbitId}:${row.kind}`;
    const existing = lastCare.get(key);
    if (!existing || row.doneAt > existing) lastCare.set(key, row.doneAt);
  }

  const followUpsByRabbit = new Map<number, { title: string; followUpAt: string }[]>();
  for (const row of followUpRows) {
    if (!row.followUpAt) continue;
    const list = followUpsByRabbit.get(row.rabbitId) ?? [];
    list.push({ title: row.title, followUpAt: row.followUpAt.toISOString() });
    followUpsByRabbit.set(row.rabbitId, list);
  }

  const now = new Date();
  const summaries = rows.map((row) => {
    const summary = weightSummary(weightsByRabbit.get(row.id) ?? []);
    const badges = needsAttention(
      {
        weightAlert: summary.weightAlert,
        vaccinations: vaccinationsByRabbit.get(row.id) ?? [],
        care: (schedulesByRabbit.get(row.id) ?? []).map((schedule) => ({
          kind: schedule.kind,
          lastDoneAt: lastCare.get(`${row.id}:${schedule.kind}`) ?? null,
          intervalDays: schedule.intervalDays,
        })),
        followUps: followUpsByRabbit.get(row.id) ?? [],
      },
      now,
    );
    return {
      ...rabbitToDto(row),
      latestWeightGrams: summary.latestWeightGrams,
      weightChangeGrams: summary.weightChangeGrams,
      weightAlert: summary.weightAlert as WeightAlert | null,
      badges: badges as AttentionBadgeDto[],
    };
  });
  res.json({ rabbits: summaries });
});

rabbitsRouter.post(
  "/",
  requireAuth,
  requirePermission("canCreateRabbits"),
  async (req, res) => {
    const input = parseInput(rabbitCreateSchema, req.body);
    const [row] = await db.insert(rabbits).values(input).returning();
    if (!req.user!.isAdmin) {
      await db.insert(rabbitCarers).values({ rabbitId: row.id, userId: req.user!.id });
    }
    res.status(201).json({ rabbit: rabbitToDto(row) });
  },
);

rabbitsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = parseId(String(req.params.id));
  const row = await findVisibleRabbit(req.user!, id);
  const [
    checks,
    treatments,
    vaccinations,
    schedules,
    records,
    appointmentRows,
    carerRows,
    journalRows,
    bondRows,
  ] = await Promise.all([
    listChecksForRabbit(id),
    listTreatmentsForRabbit(id),
    listVaccinationsForRabbit(id),
    listSchedulesForRabbit(id),
    listRecordsForRabbit(id),
    listAppointmentsForRabbit(id),
    req.user!.isAdmin
      ? db
          .select({ user: users })
          .from(rabbitCarers)
          .innerJoin(users, eq(rabbitCarers.userId, users.id))
          .where(eq(rabbitCarers.rabbitId, id))
          .orderBy(users.displayName)
      : Promise.resolve([]),
    listJournalForRabbit(id),
    listBondsForRabbit(id),
  ]);
  const stageRows = await db
    .select()
    .from(rabbitStageCompletions)
    .where(eq(rabbitStageCompletions.rabbitId, id));
  res.json({
    rabbit: rabbitToDto(row),
    carers: carerRows.map((carer) => userToDto(carer.user)),
    bonds: bondRows.map((bond) => rabbitToDto(bond)),
    stageCompletions: stageRows.map((stage) => stageCompletionToDto(stage, id)),
    checks: checks.map(healthCheckToDto),
    treatments: treatments.map(treatmentToDto),
    vaccinations: vaccinations.map(vaccinationToDto),
    careSchedules: schedules.map(careScheduleToDto),
    careRecords: records.map(careRecordToDto),
    appointments: appointmentRows.map((row) => appointmentToDto(row, hideCosts(req.user!))),
    journal: journalRows.map((item) => journalEntryToDto(item.entry, item.photos)),
  });
});

rabbitsRouter.get("/:id/checks", requireAuth, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findVisibleRabbit(req.user!, id);
  const rows = await listChecksForRabbit(id);
  res.json({ checks: rows.map(healthCheckToDto) });
});

rabbitsRouter.get("/:id/report", requireAuth, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findVisibleRabbit(req.user!, id);
  const bundle = await buildReportBundle(id, {
    hideCosts: hideCosts(req.user!),
    includeCarers: req.user!.isAdmin,
  });
  if (!bundle) throw new HttpError(404, "Rabbit not found");
  res.json(bundle);
});

rabbitsRouter.put("/:id/carers", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findVisibleRabbit(req.user!, id);
  const input = parseInput(rabbitCarersPutSchema, req.body);
  const unique = [...new Set(input.userIds)];
  if (unique.length > 0) {
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, unique));
    if (found.length !== unique.length) throw new HttpError(400, "Unknown user");
  }
  await db.delete(rabbitCarers).where(eq(rabbitCarers.rabbitId, id));
  if (unique.length > 0) {
    await db.insert(rabbitCarers).values(unique.map((userId) => ({ rabbitId: id, userId })));
  }
  const carerRows = await db
    .select({ user: users })
    .from(rabbitCarers)
    .innerJoin(users, eq(rabbitCarers.userId, users.id))
    .where(eq(rabbitCarers.rabbitId, id))
    .orderBy(users.displayName);
  res.json({ carers: carerRows.map((carer) => userToDto(carer.user)) });
});

rabbitsRouter.put(
  "/:id/bonds",
  requireAuth,
  requirePermission("canEditRabbits"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    await findVisibleRabbit(req.user!, id);
    const input = parseInput(rabbitBondsPutSchema, req.body);
    const partners = [...new Set(input.partnerIds)].filter((partnerId) => partnerId !== id);
    if (partners.length > 0) {
      const found = await db
        .select({ id: rabbits.id })
        .from(rabbits)
        .where(inArray(rabbits.id, partners));
      if (found.length !== partners.length) throw new HttpError(400, "Unknown bunny");
    }
    await db.transaction(async (tx) => {
      await tx.delete(rabbitBonds).where(eq(rabbitBonds.rabbitId, id));
      await tx.delete(rabbitBonds).where(eq(rabbitBonds.partnerId, id));
      if (partners.length > 0) {
        await tx.insert(rabbitBonds).values(
          partners.flatMap((partnerId) => [
            { rabbitId: id, partnerId },
            { rabbitId: partnerId, partnerId: id },
          ]),
        );
      }
    });
    const bonds = await listBondsForRabbit(id);
    res.json({ bonds: bonds.map(rabbitToDto) });
  },
);

rabbitsRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("canEditRabbits"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    await findVisibleRabbit(req.user!, id);
    const input = parseInput(rabbitUpdateSchema, req.body);
    const [row] = await db
      .update(rabbits)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(rabbits.id, id))
      .returning();
    res.json({ rabbit: rabbitToDto(row) });
  },
);

rabbitsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findVisibleRabbit(req.user!, id);
  const checks = await db
    .select({ id: healthChecks.id })
    .from(healthChecks)
    .where(eq(healthChecks.rabbitId, id));
  const journalPhotoRows = await db
    .select({ id: journalPhotos.id })
    .from(journalPhotos)
    .innerJoin(journalEntries, eq(journalPhotos.entryId, journalEntries.id))
    .where(eq(journalEntries.rabbitId, id));
  await db.delete(rabbits).where(eq(rabbits.id, id));
  for (const check of checks) {
    await deletePhotoDir("check", check.id);
  }
  for (const photo of journalPhotoRows) {
    await deletePhotoDir("journal", photo.id);
  }
  await deletePhotoDir("rabbit", id);
  res.json({ ok: true });
});

rabbitsRouter.post(
  "/:id/avatar",
  requireAuth,
  requirePermission("canEditRabbits"),
  photoUpload.single("photo"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    await findVisibleRabbit(req.user!, id);
    if (!req.file) throw new HttpError(400, "No photo uploaded");
    await savePhoto("rabbit", id, req.file);
    const [row] = await db
      .update(rabbits)
      .set({ hasAvatar: true, updatedAt: new Date() })
      .where(eq(rabbits.id, id))
      .returning();
    res.json({ rabbit: rabbitToDto(row) });
  },
);

async function listBondsForRabbit(rabbitId: number): Promise<RabbitRow[]> {
  const rows = await db
    .select({ rabbit: rabbits })
    .from(rabbitBonds)
    .innerJoin(rabbits, eq(rabbitBonds.partnerId, rabbits.id))
    .where(eq(rabbitBonds.rabbitId, rabbitId))
    .orderBy(rabbits.name);
  return rows.map((row) => row.rabbit);
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Rabbit not found");
  return id;
}
