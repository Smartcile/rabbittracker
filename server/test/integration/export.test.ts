import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BowlDto, RabbitDto, TaskDto } from "../../../shared/types.ts";
import * as schema from "../../src/db/schema.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

const photoDir = await mkdtemp(join(tmpdir(), "rabbittracker-export-"));
process.env.DATA_DIR = photoDir;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Backup = {
  exportedAt: string;
  version: number;
  tables: Record<string, Record<string, unknown>[]>;
};

describe("backup export integration", () => {
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

  function schemaTableNames(): string[] {
    const values: unknown[] = Object.values(schema);
    return values
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => getTableConfig(table).name)
      .sort();
  }

  it("dumps every schema table except sessions", async () => {
    const backup = await api<Backup>(ctx, "/api/export/backup.json");
    expect(backup.version).toBe(2);
    expect(Object.keys(backup.tables).sort()).toEqual(
      schemaTableNames().filter((name) => name !== "sessions"),
    );
  });

  it("includes rows from the newer feature tables", async () => {
    const { rabbit } = await api<{ rabbit: RabbitDto }>(ctx, "/api/rabbits", {
      method: "POST",
      body: { name: "Backup bunny" },
    });
    await api<{ bowl: BowlDto }>(ctx, "/api/bowls", {
      method: "POST",
      body: {
        rabbitId: rabbit.id,
        label: "Water bowl",
        startWeightGrams: 900,
        startedAt: "2026-09-01T08:00:00.000Z",
      },
    });
    await api<{ task: TaskDto }>(ctx, "/api/tasks", {
      method: "POST",
      body: { rabbitId: rabbit.id, label: "Clean litter", slot: "morning", intervalDays: 3 },
    });
    await api(ctx, "/api/journal", {
      method: "POST",
      body: { rabbitId: rabbit.id, note: "Settled in" },
    });

    const backup = await api<Backup>(ctx, "/api/export/backup.json");
    expect(backup.tables.rabbits).toHaveLength(1);
    expect(backup.tables.rabbits[0]?.name).toBe("Backup bunny");
    expect(backup.tables.bowls).toHaveLength(1);
    expect(backup.tables.bowl_readings).toHaveLength(1);
    expect(backup.tables.rabbit_tasks).toHaveLength(1);
    expect(backup.tables.journal_entries).toHaveLength(1);
  });

  it("never includes password or PIN hashes", async () => {
    const backup = await api<Backup>(ctx, "/api/export/backup.json");
    const users = backup.tables.users ?? [];
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.pinHash).toBeUndefined();
    }
    expect(JSON.stringify(backup.tables.users)).not.toContain("Hash");
  });

  it("streams a zip with the backup json and the photo files", async () => {
    const { rabbit } = await api<{ rabbit: RabbitDto }>(ctx, "/api/rabbits", {
      method: "POST",
      body: { name: "Photo bunny" },
    });
    const form = new FormData();
    form.append("photo", new Blob([PNG_1X1], { type: "image/png" }), "bunny.png");
    const upload = await fetch(`${ctx.baseUrl}/api/rabbits/${rabbit.id}/avatar`, {
      method: "POST",
      headers: { Cookie: ctx.cookie },
      body: form,
    });
    expect(upload.ok).toBe(true);

    const response = await fetch(`${ctx.baseUrl}/api/export/backup.zip`, {
      headers: { Cookie: ctx.cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const backup = JSON.parse(new TextDecoder().decode(archive["backup.json"])) as Backup;
    expect(backup.version).toBe(2);
    expect(backup.tables.rabbits).toHaveLength(1);
    expect(backup.tables.rabbits[0]?.name).toBe("Photo bunny");
    expect(archive[`photos/rabbit-${rabbit.id}/thumb.jpg`]?.length).toBeGreaterThan(0);
    expect(archive[`photos/rabbit-${rabbit.id}/full.jpg`]?.length).toBeGreaterThan(0);
    expect(JSON.stringify(backup.tables.users)).not.toContain("Hash");
  });
});
