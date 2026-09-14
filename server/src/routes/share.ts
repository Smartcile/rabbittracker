import { Router } from "express";
import { HttpError } from "../lib/http.ts";
import { isValidShareToken } from "../lib/settingsStore.ts";
import { buildReportBundle } from "../services/reportBundle.ts";

export const shareRouter = Router();

shareRouter.get("/:token/rabbits/:id", async (req, res) => {
  const token = String(req.params.token);
  if (!(await isValidShareToken(token))) {
    throw new HttpError(404, "Not found");
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found");
  const bundle = await buildReportBundle(id, { hideCosts: true, includeCarers: false });
  if (!bundle) throw new HttpError(404, "Not found");
  res.setHeader("Cache-Control", "no-store");
  res.json(bundle);
});
