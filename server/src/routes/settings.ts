import { eq } from "drizzle-orm";
import { Router } from "express";
import { settingsToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { settings } from "../db/schema.ts";
import { hasPermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { disableDemoData, enableDemoData } from "../lib/demoSeed.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  ensureFeedToken,
  ensureSettingsRow,
  ensureShareToken,
  getSettings,
  regenerateShareToken,
} from "../lib/settingsStore.ts";
import { demoToggleSchema, normsUpdateSchema } from "../lib/validation.ts";

export const settingsRouter = Router();

settingsRouter.get("/", requireAuth, async (req, res) => {
  await ensureFeedToken();
  if (req.user!.isAdmin) await ensureShareToken();
  const dto = settingsToDto(await getSettings());
  if (!hasPermission(req.user!, "canManageCalendar")) dto.feedToken = "";
  if (!req.user!.isAdmin) dto.shareToken = "";
  res.json({ settings: dto });
});

settingsRouter.post("/share-token/regenerate", requireAuth, requireAdmin, async (_req, res) => {
  await regenerateShareToken();
  res.json({ settings: settingsToDto(await getSettings()) });
});

settingsRouter.put("/norms", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(normsUpdateSchema, req.body);
  if (input.foodMinGramsPerKg > input.foodMaxGramsPerKg) {
    throw new HttpError(400, "Food minimum must be below maximum");
  }
  if (input.waterMinMilliLitresPerKg > input.waterMaxMilliLitresPerKg) {
    throw new HttpError(400, "Water minimum must be below maximum");
  }
  await ensureSettingsRow();
  await db
    .update(settings)
    .set({
      foodMinGramsPerKg: input.foodMinGramsPerKg,
      foodMaxGramsPerKg: input.foodMaxGramsPerKg,
      waterMinMilliLitresPerKg: input.waterMinMilliLitresPerKg,
      waterMaxMilliLitresPerKg: input.waterMaxMilliLitresPerKg,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  res.json({ settings: settingsToDto(await getSettings()) });
});

settingsRouter.put("/demo", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(demoToggleSchema, req.body);
  if (input.enabled) {
    await enableDemoData();
  } else {
    await disableDemoData();
  }
  const settings = await getSettings();
  if (!settings) throw new HttpError(500, "Settings unavailable");
  res.json({ settings: settingsToDto(settings) });
});
