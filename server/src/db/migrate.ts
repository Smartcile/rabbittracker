import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index.ts";

export async function runMigrations(): Promise<void> {
  const folder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(db, { migrationsFolder: folder });
}
