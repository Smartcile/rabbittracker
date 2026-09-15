import { asc, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import type { FoodProductDto } from "../../../shared/types.ts";
import { foodProductToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { foodProducts, foodStockEntries } from "../db/schema.ts";
import type { FoodProductRow, FoodStockEntryRow } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  foodProductCreateSchema,
  foodProductUpdateSchema,
  foodStockEntryCreateSchema,
} from "../lib/validation.ts";

export const foodProductsRouter = Router();

foodProductsRouter.get("/", requireAuth, async (_req, res) => {
  res.json({ products: await listProducts() });
});

foodProductsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(foodProductCreateSchema, req.body);
  const [row] = await db
    .insert(foodProducts)
    .values({
      name: input.name,
      type: input.type,
      reorderLevelGrams: input.reorderLevelGrams,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ product: foodProductToDto(row, []) });
});

foodProductsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Product not found");
  const existing = await findProduct(id);
  const input = parseInput(foodProductUpdateSchema, req.body);
  const [row] = await db
    .update(foodProducts)
    .set({
      name: input.name ?? existing.name,
      type: input.type ?? existing.type,
      reorderLevelGrams: input.reorderLevelGrams ?? existing.reorderLevelGrams,
      notes: input.notes ?? existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(foodProducts.id, id))
    .returning();
  res.json({ product: foodProductToDto(row, await listEntries(id)) });
});

foodProductsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Product not found");
  await findProduct(id);
  await db.delete(foodProducts).where(eq(foodProducts.id, id));
  res.json({ ok: true });
});

foodProductsRouter.post(
  "/:id/entries",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const id = parseId(String(req.params.id), "Product not found");
    const product = await findProduct(id);
    const input = parseInput(foodStockEntryCreateSchema, req.body);
    const [entry] = await db
      .insert(foodStockEntries)
      .values({ productId: id, amountGrams: input.amountGrams, note: input.note })
      .returning();
    res.status(201).json({ product: foodProductToDto(product, await listEntries(id)), entry });
  },
);

foodProductsRouter.delete(
  "/entries/:id",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const id = parseId(String(req.params.id), "Stock entry not found");
    const rows = await db.select().from(foodStockEntries).where(eq(foodStockEntries.id, id)).limit(1);
    if (!rows[0]) throw new HttpError(404, "Stock entry not found");
    await db.delete(foodStockEntries).where(eq(foodStockEntries.id, id));
    res.json({ product: foodProductToDto(await findProduct(rows[0].productId), await listEntries(rows[0].productId)) });
  },
);

async function listProducts(): Promise<FoodProductDto[]> {
  const rows = await db.select().from(foodProducts).orderBy(asc(foodProducts.name));
  if (rows.length === 0) return [];
  const entries = await db
    .select()
    .from(foodStockEntries)
    .where(inArray(foodStockEntries.productId, rows.map((row) => row.id)))
    .orderBy(desc(foodStockEntries.createdAt), desc(foodStockEntries.id));
  return rows.map((row) => foodProductToDto(row, entries.filter((entry) => entry.productId === row.id)));
}

async function listEntries(productId: number): Promise<FoodStockEntryRow[]> {
  return db
    .select()
    .from(foodStockEntries)
    .where(eq(foodStockEntries.productId, productId))
    .orderBy(desc(foodStockEntries.createdAt), desc(foodStockEntries.id));
}

function parseId(value: string, message: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, message);
  return id;
}

async function findProduct(id: number): Promise<FoodProductRow> {
  const rows = await db.select().from(foodProducts).where(eq(foodProducts.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Product not found");
  return rows[0];
}
