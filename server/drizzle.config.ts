import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile?.();
} catch {}

export default defineConfig({
  schema: "./server/src/db/schema.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://rabbittracker:rabbittracker@localhost:5434/rabbittracker",
  },
});
