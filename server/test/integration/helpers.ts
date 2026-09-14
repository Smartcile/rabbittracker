import { sql } from "drizzle-orm";
import pg from "pg";

const DEFAULT_TEST_DATABASE_URL =
  "postgres://rabbittracker:rabbittracker@localhost:5434/rabbittracker_test";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

export type TestContext = {
  baseUrl: string;
  cookie: string;
  close: () => Promise<void>;
};

const BUSINESS_TABLES = [
  "rabbits",
  "health_checks",
  "treatments",
  "vaccinations",
  "care_schedules",
  "care_records",
  "appointments",
  "calendar_subscriptions",
  "calendar_events",
  "drugs",
  "drug_batches",
].join(", ");

async function ensureTestDatabase(): Promise<void> {
  const database = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
  const maintenance = new URL(testDatabaseUrl);
  maintenance.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }
}

export async function resetBusinessData(): Promise<void> {
  const { db } = await import("../../src/db/index.ts");
  await db.execute(sql.raw(`TRUNCATE ${BUSINESS_TABLES} RESTART IDENTITY CASCADE`));
}

export async function startTestServer(): Promise<TestContext> {
  await ensureTestDatabase();
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.COOKIE_SECURE = "false";

  const { createApp } = await import("../../src/app.ts");
  const { runMigrations } = await import("../../src/db/migrate.ts");
  const { db, pool } = await import("../../src/db/index.ts");
  const { ensureSettingsRow } = await import("../../src/lib/settingsStore.ts");

  await runMigrations();
  await db.execute(
    sql.raw(`TRUNCATE users, sessions, settings, ${BUSINESS_TABLES} RESTART IDENTITY CASCADE`),
  );
  await ensureSettingsRow();

  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Test server did not bind a port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await setupAdmin(baseUrl);

  return {
    baseUrl,
    cookie,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}

async function setupAdmin(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "tester", displayName: "Tester", password: "password123" }),
  });
  if (!response.ok) {
    throw new Error(`Test admin setup failed (${response.status}): ${await response.text()}`);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Test admin setup returned no session cookie");
  return cookie;
}

export async function api<T>(
  ctx: TestContext,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${ctx.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Cookie: ctx.cookie,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : text;
    throw new Error(`${response.status} ${message}`);
  }
  return data as T;
}
