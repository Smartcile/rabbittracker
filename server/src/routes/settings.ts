import { Router } from "express";
import { settingsToDto } from "../api/mappers.ts";
import { hasPermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { disableDemoData, enableDemoData } from "../lib/demoSeed.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { ensureFeedToken, getSettings } from "../lib/settingsStore.ts";
import { demoToggleSchema } from "../lib/validation.ts";

export const settingsRouter = Router();

settingsRouter.get("/", requireAuth, async (req, res) => {
  await ensureFeedToken();
  const dto = settingsToDto(await getSettings());
  if (!hasPermission(req.user!, "canManageCalendar")) dto.feedToken = "";
  res.json({ settings: dto });
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
