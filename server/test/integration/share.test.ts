import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RabbitDto, ReportBundleDto, SettingsDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

const photoDir = await mkdtemp(join(tmpdir(), "rabbittracker-share-"));
process.env.DATA_DIR = photoDir;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("share link integration", () => {
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

  async function shareToken(): Promise<string> {
    const { settings } = await api<{ settings: SettingsDto }>(ctx, "/api/settings");
    return settings.shareToken;
  }

  function fetchShare(token: string, id: number): Promise<Response> {
    return fetch(`${ctx.baseUrl}/api/share/${token}/rabbits/${id}`);
  }

  it("serves a read-only report bundle to anyone with the token", async () => {
    const rabbit = await createRabbit();
    await api(ctx, "/api/checks", {
      method: "POST",
      body: { rabbitId: rabbit.id, checkedAt: "2026-09-10T09:00:00.000Z", weightGrams: 2300 },
    });
    await api(ctx, "/api/appointments", {
      method: "POST",
      body: {
        rabbitId: rabbit.id,
        title: "Check-up",
        scheduledAt: "2026-09-20T10:00:00.000Z",
        costCents: 8500,
      },
    });
    const token = await shareToken();
    expect(token).toHaveLength(32);

    const response = await fetchShare(token, rabbit.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const bundle = (await response.json()) as ReportBundleDto;
    expect(bundle.rabbit.name).toBe("Clover");
    expect(bundle.checks).toHaveLength(1);
    expect(bundle.appointments[0]?.costCents).toBeNull();
    expect(bundle.carers).toEqual([]);
  });

  it("rejects a bad token or unknown bunny with 404", async () => {
    const rabbit = await createRabbit();
    const token = await shareToken();
    expect((await fetchShare("nope", rabbit.id)).status).toBe(404);
    expect((await fetchShare(token, 99999)).status).toBe(404);
  });

  it("invalidates old links when the token is regenerated", async () => {
    const rabbit = await createRabbit();
    const oldToken = await shareToken();
    expect((await fetchShare(oldToken, rabbit.id)).status).toBe(200);
    const { settings } = await api<{ settings: SettingsDto }>(
      ctx,
      "/api/settings/share-token/regenerate",
      { method: "POST" },
    );
    expect(settings.shareToken).not.toBe(oldToken);
    expect((await fetchShare(oldToken, rabbit.id)).status).toBe(404);
    expect((await fetchShare(settings.shareToken, rabbit.id)).status).toBe(200);
  });

  it("keeps the authenticated report private and admin-aware", async () => {
    const rabbit = await createRabbit();
    await api(ctx, "/api/appointments", {
      method: "POST",
      body: {
        rabbitId: rabbit.id,
        title: "Check-up",
        scheduledAt: "2026-09-20T10:00:00.000Z",
        costCents: 8500,
      },
    });
    const anonymous = await fetch(`${ctx.baseUrl}/api/rabbits/${rabbit.id}/report`);
    expect(anonymous.status).toBe(401);
    const bundle = await api<ReportBundleDto>(ctx, `/api/rabbits/${rabbit.id}/report`);
    expect(bundle.appointments[0]?.costCents).toBe(8500);
  });

  it("serves photos with the share token but not without one", async () => {
    const rabbit = await createRabbit();
    const form = new FormData();
    form.append("photo", new Blob([PNG_1X1], { type: "image/png" }), "bunny.png");
    const upload = await fetch(`${ctx.baseUrl}/api/rabbits/${rabbit.id}/avatar`, {
      method: "POST",
      headers: { Cookie: ctx.cookie },
      body: form,
    });
    expect(upload.ok).toBe(true);
    const token = await shareToken();

    const anonymous = await fetch(`${ctx.baseUrl}/api/photos/rabbit/${rabbit.id}?size=thumb`);
    expect(anonymous.status).toBe(401);
    const badToken = await fetch(
      `${ctx.baseUrl}/api/photos/rabbit/${rabbit.id}?size=thumb&token=nope`,
    );
    expect(badToken.status).toBe(401);
    const shared = await fetch(
      `${ctx.baseUrl}/api/photos/rabbit/${rabbit.id}?size=thumb&token=${token}`,
    );
    expect(shared.status).toBe(200);
    expect(shared.headers.get("content-type")).toContain("image/jpeg");
  });
});
