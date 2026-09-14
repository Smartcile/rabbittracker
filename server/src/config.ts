import { resolve } from "node:path";

try {
  process.loadEnvFile?.();
} catch {}

function envInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

const postgresUser = process.env.POSTGRES_USER ?? "rabbittracker";
const postgresPassword = process.env.POSTGRES_PASSWORD ?? "rabbittracker";
const postgresDb = process.env.POSTGRES_DB ?? "rabbittracker";

export const config = {
  port: envInt(process.env.APP_PORT, 8091),
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgres://${postgresUser}:${postgresPassword}@localhost:5434/${postgresDb}`,
  cookieSecure: envBool(process.env.COOKIE_SECURE, false),
  sessionIdleMinutes: envInt(process.env.SESSION_IDLE_MINUTES, 30),
  sessionTtlMinutes: envInt(process.env.SESSION_TTL_MINUTES, 10080),
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
} as const;
