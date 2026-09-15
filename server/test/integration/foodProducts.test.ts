import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BowlDto, FoodProductDto, RabbitDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("food product integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetBusinessData();
  });

  async function createRabbit(): Promise<RabbitDto> {
    const { rabbit } = await api<{ rabbit: RabbitDto }>(ctx, "/api/rabbits", {
      method: "POST",
      body: { name: "Clover" },
    });
    return rabbit;
  }

  async function createProduct(): Promise<FoodProductDto> {
    const { product } = await api<{ product: FoodProductDto }>(ctx, "/api/food-products", {
      method: "POST",
      body: { name: "Timothy hay", type: "Hay", reorderLevelGrams: 500 },
    });
    return product;
  }

  async function addStock(productId: number, amountGrams: number): Promise<FoodProductDto> {
    const { product } = await api<{ product: FoodProductDto }>(
      ctx,
      `/api/food-products/${productId}/entries`,
      { method: "POST", body: { amountGrams } },
    );
    return product;
  }

  async function createBowl(rabbitId: number, productId?: number): Promise<BowlDto> {
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, "/api/bowls", {
      method: "POST",
      body: {
        rabbitId,
        label: "Hay bowl",
        startWeightGrams: 500,
        startedAt: "2026-09-01T08:00:00.000Z",
        productId,
      },
    });
    return bowl;
  }

  async function getProduct(id: number): Promise<FoodProductDto> {
    const { products } = await api<{ products: FoodProductDto[] }>(ctx, "/api/food-products");
    const product = products.find((row) => row.id === id);
    if (!product) throw new Error("product not found");
    return product;
  }

  it("tracks stock from entries", async () => {
    const product = await createProduct();
    expect(product.stockGrams).toBe(0);

    const added = await addStock(product.id, 2000);
    expect(added.stockGrams).toBe(2000);

    const removed = await addStock(product.id, -500);
    expect(removed.stockGrams).toBe(1500);
    expect(removed.entries).toHaveLength(2);
  });

  it("removes a stock entry and recalculates the total", async () => {
    const product = await createProduct();
    const withStock = await addStock(product.id, 2000);
    const entry = withStock.entries[0];
    if (!entry) throw new Error("entry not found");

    const { product: after } = await api<{ product: FoodProductDto }>(
      ctx,
      `/api/food-products/entries/${entry.id}`,
      { method: "DELETE" },
    );
    expect(after.stockGrams).toBe(0);
  });

  it("draws stock when topping up a linked bowl", async () => {
    const rabbit = await createRabbit();
    const product = await createProduct();
    await addStock(product.id, 2000);
    const bowl = await createBowl(rabbit.id, product.id);

    const { bowl: updated } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings`,
      { method: "POST", body: { kind: "refill", readAt: "2026-09-02T08:00:00.000Z", refillGrams: 250 } },
    );
    expect(updated.currentWeightGrams).toBe(750);
    expect((await getProduct(product.id)).stockGrams).toBe(1750);

    const reading = updated.readings.find((row) => row.kind === "refill");
    if (!reading) throw new Error("refill not found");
    await api(ctx, `/api/bowls/${bowl.id}/readings/${reading.id}`, { method: "DELETE" });
    expect((await getProduct(product.id)).stockGrams).toBe(2000);
  });

  it("adjusts stock when a refill is edited", async () => {
    const rabbit = await createRabbit();
    const product = await createProduct();
    await addStock(product.id, 2000);
    const bowl = await createBowl(rabbit.id, product.id);

    const { bowl: afterRefill } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings`,
      { method: "POST", body: { kind: "refill", readAt: "2026-09-02T08:00:00.000Z", refillGrams: 250 } },
    );
    const reading = afterRefill.readings.find((row) => row.kind === "refill");
    if (!reading) throw new Error("refill not found");

    await api(ctx, `/api/bowls/${bowl.id}/readings/${reading.id}`, {
      method: "PATCH",
      body: { refillGrams: 100 },
    });
    expect((await getProduct(product.id)).stockGrams).toBe(1900);
  });

  it("rejects a bowl linked to an unknown product", async () => {
    const rabbit = await createRabbit();
    await expect(
      api(ctx, "/api/bowls", {
        method: "POST",
        body: {
          rabbitId: rabbit.id,
          label: "Hay bowl",
          startWeightGrams: 500,
          startedAt: "2026-09-01T08:00:00.000Z",
          productId: 9999,
        },
      }),
    ).rejects.toThrow("Product not found");
  });
});
