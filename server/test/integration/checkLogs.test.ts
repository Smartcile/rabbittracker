import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CheckLogDto, CheckLogTypeDto, RabbitDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

const photoDir = await mkdtemp(join(tmpdir(), "rabbittracker-checklog-"));
process.env.DATA_DIR = photoDir;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("check log integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await ctx.close();
    await rm(photoDir, { recursive: true, force: true });
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

  async function createType(overrides: Record<string, unknown> = {}): Promise<CheckLogTypeDto> {
    const { type } = await api<{ type: CheckLogTypeDto }>(ctx, "/api/check-logs/types", {
      method: "POST",
      body: {
        label: "Behaviour",
        options: ["Binkies", "Exploring"],
        hasNumber: false,
        multiple: true,
        ...overrides,
      },
    });
    return type;
  }

  async function createLog(rabbitId: number, typeId: number): Promise<CheckLogDto> {
    const { log } = await api<{ log: CheckLogDto }>(ctx, "/api/check-logs", {
      method: "POST",
      body: {
        rabbitId,
        typeId,
        loggedAt: "2026-09-13T09:00:00.000Z",
        valueLabels: ["Binkies", "Exploring"],
        notes: "Very lively",
      },
    });
    return log;
  }

  async function uploadPhoto(logId: number): Promise<number> {
    const form = new FormData();
    form.append("photo", new Blob([PNG_1X1], { type: "image/png" }), "poo.png");
    const response = await fetch(`${ctx.baseUrl}/api/check-logs/${logId}/photos`, {
      method: "POST",
      headers: { Cookie: ctx.cookie },
      body: form,
    });
    const data = (await response.json()) as { photo?: { id: number }; error?: string };
    if (!response.ok || !data.photo) {
      throw new Error(`${response.status} ${data.error ?? "upload failed"}`);
    }
    return data.photo.id;
  }

  it("stores multi-select labels on a log", async () => {
    const rabbit = await createRabbit();
    const type = await createType();
    expect(type.multiple).toBe(true);

    const log = await createLog(rabbit.id, type.id);
    expect(log.valueLabels).toEqual(["Binkies", "Exploring"]);
    expect(log.photos).toEqual([]);

    const { logs } = await api<{ logs: CheckLogDto[] }>(ctx, `/api/check-logs?rabbitId=${rabbit.id}`);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.valueLabels).toEqual(["Binkies", "Exploring"]);
    expect(logs[0]?.notes).toBe("Very lively");
  });

  it("updates the selected labels", async () => {
    const rabbit = await createRabbit();
    const type = await createType();
    const log = await createLog(rabbit.id, type.id);

    const { log: updated } = await api<{ log: CheckLogDto }>(ctx, `/api/check-logs/${log.id}`, {
      method: "PATCH",
      body: { valueLabels: ["Flopped"] },
    });
    expect(updated.valueLabels).toEqual(["Flopped"]);
  });

  it("uploads, serves and removes a photo", async () => {
    const rabbit = await createRabbit();
    const type = await createType();
    const log = await createLog(rabbit.id, type.id);

    const photoId = await uploadPhoto(log.id);
    const { logs } = await api<{ logs: CheckLogDto[] }>(ctx, `/api/check-logs?rabbitId=${rabbit.id}`);
    expect(logs[0]?.photos.map((photo) => photo.id)).toEqual([photoId]);

    const image = await fetch(`${ctx.baseUrl}/api/photos/checklog/${photoId}?size=thumb`, {
      headers: { Cookie: ctx.cookie },
    });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/jpeg");

    await api(ctx, `/api/check-logs/photos/${photoId}`, { method: "DELETE" });
    const after = await api<{ logs: CheckLogDto[] }>(ctx, `/api/check-logs?rabbitId=${rabbit.id}`);
    expect(after.logs[0]?.photos).toEqual([]);

    const gone = await fetch(`${ctx.baseUrl}/api/photos/checklog/${photoId}?size=thumb`, {
      headers: { Cookie: ctx.cookie },
    });
    expect(gone.status).toBe(404);
  });

  it("removes photo files when the log is deleted", async () => {
    const rabbit = await createRabbit();
    const type = await createType();
    const log = await createLog(rabbit.id, type.id);
    const photoId = await uploadPhoto(log.id);

    await api(ctx, `/api/check-logs/${log.id}`, { method: "DELETE" });

    const gone = await fetch(`${ctx.baseUrl}/api/photos/checklog/${photoId}?size=thumb`, {
      headers: { Cookie: ctx.cookie },
    });
    expect(gone.status).toBe(404);
    const { logs } = await api<{ logs: CheckLogDto[] }>(ctx, `/api/check-logs?rabbitId=${rabbit.id}`);
    expect(logs).toEqual([]);
  });
});
