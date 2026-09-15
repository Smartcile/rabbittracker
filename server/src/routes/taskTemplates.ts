import { asc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { taskTemplateToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { foodProducts, taskTemplates } from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { taskTemplateCreateSchema, taskTemplateUpdateSchema } from "../lib/validation.ts";

export const taskTemplatesRouter = Router();

taskTemplatesRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(taskTemplates)
    .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.id));
  const names = await productNames(rows.map((row) => row.productId));
  res.json({
    templates: rows.map((row) =>
      taskTemplateToDto(row, row.productId !== null ? (names.get(row.productId) ?? null) : null),
    ),
  });
});

taskTemplatesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(taskTemplateCreateSchema, req.body);
  const [{ value: highest }] = await db
    .select({ value: max(taskTemplates.sortOrder) })
    .from(taskTemplates);
  const [row] = await db
    .insert(taskTemplates)
    .values({
      label: input.label,
      slot: input.slot,
      intervalDays: input.intervalDays,
      startDate: input.startDate ?? null,
      productId: input.productId ?? null,
      amountGrams: input.amountGrams,
      notes: input.notes,
      active: input.active,
      sortOrder: (highest ?? -1) + 1,
    })
    .returning();
  res.status(201).json({ template: taskTemplateToDto(row, await productName(row.productId)) });
});

taskTemplatesRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const template = await findTemplate(parseId(String(req.params.id)));
  const input = parseInput(taskTemplateUpdateSchema, req.body);
  const [row] = await db
    .update(taskTemplates)
    .set({
      label: input.label ?? template.label,
      slot: input.slot ?? template.slot,
      intervalDays: input.intervalDays ?? template.intervalDays,
      startDate: input.startDate !== undefined ? input.startDate : template.startDate,
      productId: input.productId !== undefined ? input.productId : template.productId,
      amountGrams: input.amountGrams ?? template.amountGrams,
      notes: input.notes !== undefined ? input.notes : template.notes,
      active: input.active !== undefined ? input.active : template.active,
      updatedAt: new Date(),
    })
    .where(eq(taskTemplates.id, template.id))
    .returning();
  res.json({ template: taskTemplateToDto(row, await productName(row.productId)) });
});

taskTemplatesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const template = await findTemplate(parseId(String(req.params.id)));
  await db.delete(taskTemplates).where(eq(taskTemplates.id, template.id));
  res.json({ ok: true });
});

async function productName(productId: number | null): Promise<string | null> {
  if (productId === null) return null;
  const rows = await db
    .select({ name: foodProducts.name })
    .from(foodProducts)
    .where(eq(foodProducts.id, productId))
    .limit(1);
  return rows[0]?.name ?? null;
}

async function productNames(ids: (number | null)[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => id !== null))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: foodProducts.id, name: foodProducts.name })
    .from(foodProducts)
    .where(inArray(foodProducts.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function findTemplate(id: number) {
  const rows = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Task template not found");
  return rows[0];
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Task template not found");
  return id;
}
