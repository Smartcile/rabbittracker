import { asc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { taskTemplateToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { foodProducts, taskTemplates } from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { recurrenceFromIntervalDays, recurrenceIntervalDays } from "../../../shared/recurrence.ts";
import { taskTemplateCreateSchema, taskTemplateUpdateSchema } from "../lib/validation.ts";

export const taskTemplatesRouter = Router();

taskTemplatesRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(taskTemplates)
    .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.id));
  const names = await productNames(
    rows.flatMap((row) => (row.products ?? []).map((product) => product.productId)),
  );
  res.json({
    templates: rows.map((row) => taskTemplateToDto(row, names)),
  });
});

taskTemplatesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(taskTemplateCreateSchema, req.body);
  const [{ value: highest }] = await db
    .select({ value: max(taskTemplates.sortOrder) })
    .from(taskTemplates);
  const recurrence = input.recurrence ?? recurrenceFromIntervalDays(input.intervalDays);
  const [row] = await db
    .insert(taskTemplates)
    .values({
      label: input.label,
      slot: input.slot,
      intervalDays: recurrenceIntervalDays(recurrence),
      recurrence,
      startDate: input.startDate ?? null,
      products: input.products,
      notes: input.notes,
      active: input.active,
      sortOrder: (highest ?? -1) + 1,
    })
    .returning();
  res.status(201).json({ template: taskTemplateToDto(row, await productNamesFor(input.products)) });
});

taskTemplatesRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const template = await findTemplate(parseId(String(req.params.id)));
  const input = parseInput(taskTemplateUpdateSchema, req.body);
  const [row] = await db
    .update(taskTemplates)
    .set({
      label: input.label ?? template.label,
      slot: input.slot ?? template.slot,
      intervalDays: input.recurrence
        ? recurrenceIntervalDays(input.recurrence)
        : input.intervalDays ?? template.intervalDays,
      recurrence:
        input.recurrence ??
        (input.intervalDays !== undefined
          ? recurrenceFromIntervalDays(input.intervalDays)
          : template.recurrence),
      startDate: input.startDate !== undefined ? input.startDate : template.startDate,
      products: input.products ?? template.products,
      notes: input.notes !== undefined ? input.notes : template.notes,
      active: input.active !== undefined ? input.active : template.active,
      updatedAt: new Date(),
    })
    .where(eq(taskTemplates.id, template.id))
    .returning();
  res.json({ template: taskTemplateToDto(row, await productNamesFor(row.products ?? [])) });
});

taskTemplatesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const template = await findTemplate(parseId(String(req.params.id)));
  await db.delete(taskTemplates).where(eq(taskTemplates.id, template.id));
  res.json({ ok: true });
});

async function productNames(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: foodProducts.id, name: foodProducts.name })
    .from(foodProducts)
    .where(inArray(foodProducts.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function productNamesFor(products: { productId: number }[]): Promise<Map<number, string>> {
  return productNames(products.map((product) => product.productId));
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
