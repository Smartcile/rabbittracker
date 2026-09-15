import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Express } from "express";
import { errorHandler } from "./lib/http.ts";
import { appointmentsRouter } from "./routes/appointments.ts";
import { authRouter } from "./routes/auth.ts";
import { bowlsRouter } from "./routes/bowls.ts";
import { breedNormsRouter } from "./routes/breedNorms.ts";
import { calendarRouter } from "./routes/calendar.ts";
import { careRabbitRouter, careRecordsRouter } from "./routes/care.ts";
import { calendarEntriesRouter } from "./routes/calendarEntries.ts";
import { checkLogsRouter } from "./routes/checkLogs.ts";
import { checksRouter } from "./routes/checks.ts";
import { checklistRouter } from "./routes/checklist.ts";
import { checklistsRouter } from "./routes/checklists.ts";
import { medicationLogsRouter } from "./routes/medicationLogs.ts";
import { clinicsRouter } from "./routes/clinics.ts";
import { drugsRouter } from "./routes/drugs.ts";
import { exportRouter } from "./routes/export.ts";
import { faqRouter } from "./routes/faq.ts";
import { foodProductsRouter } from "./routes/foodProducts.ts";
import { growthStagesRouter, rabbitStagesRouter } from "./routes/growthStages.ts";
import { journalRouter } from "./routes/journal.ts";
import { lookupsRouter } from "./routes/lookups.ts";
import { photosRouter } from "./routes/photos.ts";
import { rabbitsRouter } from "./routes/rabbits.ts";
import { settingsRouter } from "./routes/settings.ts";
import { shareRouter } from "./routes/share.ts";
import { tasksRouter } from "./routes/tasks.ts";
import { taskTemplatesRouter } from "./routes/taskTemplates.ts";
import { treatmentsRouter } from "./routes/treatments.ts";
import { usersRouter } from "./routes/users.ts";
import { vaccinationsRouter } from "./routes/vaccinations.ts";
import { vetsRouter } from "./routes/vets.ts";

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/share", shareRouter);
  app.use("/api/rabbits", careRabbitRouter);
  app.use("/api/rabbits", rabbitStagesRouter);
  app.use("/api/rabbits", rabbitsRouter);
  app.use("/api/checks", checksRouter);
  app.use("/api/checklist", checklistRouter);
  app.use("/api/checklists", checklistsRouter);
  app.use("/api/check-logs", checkLogsRouter);
  app.use("/api/bowls", bowlsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/task-templates", taskTemplatesRouter);
  app.use("/api/medication-logs", medicationLogsRouter);
  app.use("/api/calendar-entries", calendarEntriesRouter);
  app.use("/api/journal", journalRouter);
  app.use("/api/vets", vetsRouter);
  app.use("/api/clinics", clinicsRouter);
  app.use("/api/lookups", lookupsRouter);
  app.use("/api/drugs", drugsRouter);
  app.use("/api/food-products", foodProductsRouter);
  app.use("/api/breed-norms", breedNormsRouter);
  app.use("/api/growth-stages", growthStagesRouter);
  app.use("/api/treatments", treatmentsRouter);
  app.use("/api/vaccinations", vaccinationsRouter);
  app.use("/api/care-records", careRecordsRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/faq", faqRouter);
  app.use("/api/export", exportRouter);
  app.use("/api/photos", photosRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        res.sendFile(join(clientDist, "index.html"));
        return;
      }
      next();
    });
  }

  app.use(errorHandler);
  return app;
}
