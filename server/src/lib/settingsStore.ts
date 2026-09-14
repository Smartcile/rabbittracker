import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { settings } from "../db/schema.ts";
import type { SettingsRow } from "../db/schema.ts";
import { tokenMatches } from "./tokens.ts";

export async function ensureSettingsRow(): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
}

export async function getSettings(): Promise<SettingsRow> {
  await ensureSettingsRow();
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return rows[0];
}

export async function ensureFeedToken(): Promise<string> {
  const row = await getSettings();
  if (row.feedToken) return row.feedToken;
  return regenerateFeedToken();
}

export async function regenerateFeedToken(): Promise<string> {
  await ensureSettingsRow();
  const token = randomBytes(16).toString("hex");
  await db
    .update(settings)
    .set({ feedToken: token, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  return token;
}

export async function ensureShareToken(): Promise<string> {
  const row = await getSettings();
  if (row.shareToken) return row.shareToken;
  return regenerateShareToken();
}

export async function regenerateShareToken(): Promise<string> {
  await ensureSettingsRow();
  const token = randomBytes(16).toString("hex");
  await db
    .update(settings)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  return token;
}

export async function isValidShareToken(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await getSettings();
  return row.shareToken !== "" && tokenMatches(token, row.shareToken);
}
