import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ChecklistDto, ChecklistItemDto, ChecklistSectionDto, CheckLogTypeDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("checklist integration", () => {
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

  async function createChecklist(label: string): Promise<ChecklistDto> {
    const { checklist } = await api<{ checklist: ChecklistDto }>(ctx, "/api/checklists", {
      method: "POST",
      body: { label },
    });
    return checklist;
  }

  async function createSection(label: string): Promise<ChecklistSectionDto> {
    const { section } = await api<{ section: ChecklistSectionDto }>(ctx, "/api/checklist/sections", {
      method: "POST",
      body: { label },
    });
    return section;
  }

  async function createType(label: string): Promise<CheckLogTypeDto> {
    const { type } = await api<{ type: CheckLogTypeDto }>(ctx, "/api/check-logs/types", {
      method: "POST",
      body: { label, options: ["One", "Two"] },
    });
    return type;
  }

  it("ships with a weekly checklist and a daily checklist", async () => {
    const { checklists } = await api<{ checklists: ChecklistDto[] }>(ctx, "/api/checklists");
    const keys = checklists.map((checklist) => checklist.key);
    expect(keys).toContain("weekly");
    expect(keys).toContain("daily");
    expect(checklists.find((checklist) => checklist.key === "daily")?.isDaily).toBe(true);
  });

  it("creates a checklist and adds sections and types", async () => {
    const checklist = await createChecklist("Post-op");
    const section = await createSection("Incision");
    const type = await createType("Appetite");

    const { items } = await api<{ items: ChecklistItemDto[] }>(
      ctx,
      `/api/checklists/${checklist.id}/items`,
      { method: "POST", body: { sectionId: section.id } },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("section");

    const { items: both } = await api<{ items: ChecklistItemDto[] }>(
      ctx,
      `/api/checklists/${checklist.id}/items`,
      { method: "POST", body: { typeId: type.id } },
    );
    expect(both.map((item) => item.kind)).toEqual(["section", "type"]);

    const { items: reordered } = await api<{ items: ChecklistItemDto[] }>(
      ctx,
      `/api/checklists/${checklist.id}/reorder`,
      { method: "PUT", body: { ids: both.map((item) => item.id).reverse() } },
    );
    expect(reordered.map((item) => item.kind)).toEqual(["type", "section"]);

    const { items: afterRemove } = await api<{ items: ChecklistItemDto[] }>(
      ctx,
      `/api/checklists/${checklist.id}/items/${reordered[0]?.id}`,
      { method: "DELETE" },
    );
    expect(afterRemove).toHaveLength(1);

    await api(ctx, `/api/checklists/${checklist.id}`, { method: "DELETE" });
    const { checklists } = await api<{ checklists: ChecklistDto[] }>(ctx, "/api/checklists");
    expect(checklists.some((item) => item.id === checklist.id)).toBe(false);
  });

  it("rejects adding the same item twice", async () => {
    const checklist = await createChecklist("Duplicates");
    const section = await createSection("Twice");
    await api(ctx, `/api/checklists/${checklist.id}/items`, {
      method: "POST",
      body: { sectionId: section.id },
    });
    await expect(
      api(ctx, `/api/checklists/${checklist.id}/items`, {
        method: "POST",
        body: { sectionId: section.id },
      }),
    ).rejects.toThrow("Already in this checklist");
  });

  it("refuses to delete the daily checklist", async () => {
    const { checklists } = await api<{ checklists: ChecklistDto[] }>(ctx, "/api/checklists");
    const daily = checklists.find((checklist) => checklist.isDaily);
    if (!daily) throw new Error("daily checklist missing");
    await expect(api(ctx, `/api/checklists/${daily.id}`, { method: "DELETE" })).rejects.toThrow(
      "cannot be deleted",
    );
  });

  it("lets a daily type be reused in another checklist", async () => {
    const checklist = await createChecklist("Reuse");
    const type = await createType("Reused");
    await api(ctx, `/api/checklists/${checklist.id}/items`, {
      method: "POST",
      body: { typeId: type.id },
    });

    const { sections, typeKeys } = await api<{ sections: ChecklistSectionDto[]; typeKeys: string[] }>(
      ctx,
      "/api/checklist",
    );
    expect(Array.isArray(sections)).toBe(true);
    expect(typeKeys).toContain(type.key);
  });

  it("schedules a checklist and defaults the weekly list to Sunday", async () => {
    const { checklists } = await api<{ checklists: ChecklistDto[] }>(ctx, "/api/checklists");
    const weekly = checklists.find((checklist) => checklist.key === "weekly");
    if (!weekly) throw new Error("weekly checklist missing");
    expect(weekly.recurrence.kind).toBe("weekdays");
    expect(weekly.recurrence.days).toEqual(["sun"]);

    const { checklist: updated } = await api<{ checklist: ChecklistDto }>(
      ctx,
      `/api/checklists/${weekly.id}`,
      {
        method: "PATCH",
        body: { recurrence: { kind: "per_week", days: [], count: 2, intervalDays: 1 } },
      },
    );
    expect(updated.recurrence.kind).toBe("per_week");
    expect(updated.recurrence.count).toBe(2);
  });
});
