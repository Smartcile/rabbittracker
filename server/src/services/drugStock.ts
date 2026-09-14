import { eq } from "drizzle-orm";
import { newestBatchId, planStockDeduction } from "../../../shared/drugs.ts";
import { db } from "../db/index.ts";
import { drugBatches } from "../db/schema.ts";

export type StockTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function deductDrugStock(
  tx: StockTx,
  drugId: number,
  amountMilliUnits: number,
): Promise<number> {
  const amount = Math.round(amountMilliUnits);
  if (amount <= 0) return 0;
  const batches = await tx.select().from(drugBatches).where(eq(drugBatches.drugId, drugId));
  const plan = planStockDeduction(batches, amount);
  for (const change of plan.changes) {
    await tx
      .update(drugBatches)
      .set({ quantityMilliUnits: change.quantityMilliUnits, updatedAt: new Date() })
      .where(eq(drugBatches.id, change.id));
  }
  return amount - plan.shortfall;
}

export async function restoreDrugStock(
  tx: StockTx,
  drugId: number,
  amountMilliUnits: number,
): Promise<void> {
  const amount = Math.round(amountMilliUnits);
  if (amount <= 0) return;
  const batches = await tx.select().from(drugBatches).where(eq(drugBatches.drugId, drugId));
  const newest = newestBatchId(batches);
  if (newest === null) {
    await tx.insert(drugBatches).values({
      drugId,
      quantityMilliUnits: amount,
      notes: "Returned from treatment",
    });
    return;
  }
  const batch = batches.find((row) => row.id === newest);
  await tx
    .update(drugBatches)
    .set({
      quantityMilliUnits: (batch?.quantityMilliUnits ?? 0) + amount,
      updatedAt: new Date(),
    })
    .where(eq(drugBatches.id, newest));
}
