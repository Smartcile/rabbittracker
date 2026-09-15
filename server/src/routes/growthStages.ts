import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import { growthStageToDto, stageCompletionToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { growthStages, rabbitStageCompletions } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { addMissingDefaultGrowthStages } from "../lib/growthStageSeed.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { growthStageCreateSchema, growthStageUpdateSchema, stageCompletionSchema } from "../lib/validation.ts";

export const growthStagesRouter = Router();
export const rabbitStagesRouter = Router();

growthStagesRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(growthStages)
    .orderBy(asc(growthStages.sortOrder), asc(growthStages.id));
  res.json({ stages: rows.map(growthStageToDto) });
});

growthStagesRouter.post("/defaults", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ added: await addMissingDefaultGrowthStages() });
});

growthStagesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(growthStageCreateSchema, req.body);
  const [row] = await db.insert(growthStages).values(input).returning();
  res.status(201).json({ stage: growthStageToDto(row) });
});

growthStagesRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id), "Stage not found");
  const existing = await findStage(id);
  const input = parseInput(growthStageUpdateSchema, req.body);
  const [row] = await db
    .update(growthStages)
    .set({
      label: input.label ?? existing.label,
      guidance: input.guidance ?? existing.guidance,
      startDays: input.startDays ?? existing.startDays,
      endDays: input.endDays ?? existing.endDays,
      sex: input.sex ?? existing.sex,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(growthStages.id, id))
    .returning();
  res.json({ stage: growthStageToDto(row) });
});

growthStagesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id), "Stage not found");
  await findStage(id);
  await db.delete(growthStages).where(eq(growthStages.id, id));
  res.json({ ok: true });
});

rabbitStagesRouter.put(
  "/:id/stages/:stageId",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const rabbitId = parseId(String(req.params.id), "Rabbit not found");
    const stageId = parseId(String(req.params.stageId), "Stage not found");
    await findVisibleRabbit(req.user!, rabbitId);
    await findStage(stageId);
    const input = parseInput(stageCompletionSchema, req.body);
    const [row] = await db
      .insert(rabbitStageCompletions)
      .values({
        rabbitId,
        stageId,
        completedAt: input.completedAt,
        notes: input.notes,
      })
      .onConflictDoUpdate({
        target: [rabbitStageCompletions.rabbitId, rabbitStageCompletions.stageId],
        set: { completedAt: input.completedAt, notes: input.notes },
      })
      .returning();
    res.json({ completion: stageCompletionToDto(row, rabbitId) });
  },
);

rabbitStagesRouter.delete(
  "/:id/stages/:stageId",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const rabbitId = parseId(String(req.params.id), "Rabbit not found");
    const stageId = parseId(String(req.params.stageId), "Stage not found");
    await findVisibleRabbit(req.user!, rabbitId);
    await db
      .delete(rabbitStageCompletions)
      .where(
        and(
          eq(rabbitStageCompletions.rabbitId, rabbitId),
          eq(rabbitStageCompletions.stageId, stageId),
        ),
      );
    res.json({ ok: true });
  },
);

function parseId(value: string, message: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, message);
  return id;
}

async function findStage(id: number) {
  const rows = await db.select().from(growthStages).where(eq(growthStages.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Stage not found");
  return rows[0];
}
