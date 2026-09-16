import { bowlReadingKindLabel } from "../../../shared/bowls.ts";
import { checkLogValueSummary } from "../../../shared/checkLogs.ts";
import { formatDrugAmount } from "../../../shared/drugs.ts";
import {
  ageLabel,
  careDueStatus,
  dueStatus,
  formatWeight,
  taskDueStatus,
  taskNextDueOn,
  treatmentScheduleStatus,
  weightTrend,
} from "../../../shared/health.ts";
import {
  checklistAnswerLines,
  dateRangesOverlap,
  isDateWithinRange,
  isWithinRange,
  type ReportRange,
} from "../../../shared/report.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { DAY_SLOT_LABELS } from "../../../shared/slots.ts";
import type {
  AppointmentDto,
  BowlDto,
  CareRecordDto,
  CareScheduleDto,
  CheckLogDto,
  GrowthStageDto,
  CheckLogTypeDto,
  ChecklistSectionDto,
  DrugDto,
  HealthCheckDto,
  JournalEntryDto,
  LookupDto,
  MedicationLogDto,
  RabbitDto,
  RabbitStageCompletionDto,
  ReportBundleDto,
  SettingsDto,
  TaskCompletionDto,
  TaskDto,
  TreatmentDto,
  VaccinationDto,
} from "../../../shared/types.ts";
import { api } from "../api.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { renderBowlsChart } from "../components/bowlChart.ts";
import { reportPeriodControls } from "../components/reportPeriod.ts";
import { toast } from "../components/toast.ts";
import { toggleButton } from "../components/toggle.ts";
import { renderWeightChart } from "../components/weightChart.ts";
import type { PageContext } from "../context.ts";
import { copyText, fmtCalendarDate, fmtDate, fmtTime, h, type Child } from "../dom.ts";
import { can } from "../permissions.ts";
import { sexLabel } from "./bunnies.ts";

export type ReportPhotoKind = "check" | "checklog" | "journal";

export function reportPhotoUrl(kind: ReportPhotoKind, id: number): string {
  return `/api/photos/${kind}/${id}?size=thumb`;
}

export type ReportView = {
  bundle: ReportBundleDto;
  range: ReportRange;
  includePhotos: boolean;
  showCost: boolean;
  showCarers: boolean;
  now: Date;
  photoUrl: (kind: ReportPhotoKind, id: number) => string;
};

export function renderReportSections(view: ReportView): HTMLElement[] {
  const { bundle, range, includePhotos, showCost, showCarers, now, photoUrl } = view;
  const timezone = bundle.timezone;
  return [
    profileSection(bundle, showCarers),
    stagesSection(bundle.growthStages, bundle.stageCompletions, timezone),
    dailyChecksSection(bundle.checkLogs, range, includePhotos, timezone, photoUrl),
    bowlsSection(bundle.bowls, range, timezone),
    tasksSection(bundle.tasks, bundle.taskCompletions, range, now, timezone),
    weightSection(bundle.rabbit, bundle.checks, range, timezone),
    checksSection(bundle.checks, bundle.checklist, bundle.logTypes, range, includePhotos, timezone, photoUrl),
    vaccinationsSection(bundle.vaccinations, range, now),
    careSection(bundle.careSchedules, bundle.careRecords, bundle.careTypes, range, now),
    treatmentsSection(bundle.treatments, bundle.medicationLogs, range, now),
    medicationSection(bundle.medicationLogs, bundle.drugs, range, timezone),
    appointmentsSection(bundle.appointments, range, showCost, timezone, now),
    journalSection(bundle.journal, range, includePhotos, timezone, photoUrl),
  ];
}

export function renderRabbitReportPage(ctx: PageContext, id: number): HTMLElement {
  document.documentElement.dataset.theme = "light";

  let includePhotos = false;
  let shareToken = "";
  let bundle: ReportBundleDto | null = null;
  const showCost = can(ctx.user, "canViewCosts");
  const isAdmin = ctx.user.isAdmin;

  const controls = h("div", { class: "card report-controls" });
  const body = h("div", { class: "report-body" });

  const period = reportPeriodControls({
    onChange: () => {
      renderControls();
      renderBody();
    },
  });

  const photosToggle = toggleButton({
    label: "Include photos",
    checked: includePhotos,
    onChange: (checked) => {
      includePhotos = checked;
      renderBody();
    },
  });

  const download = h(
    "button",
    { class: "btn primary", type: "button", onClick: () => window.print() },
    "Download PDF",
  );

  async function copyShareLink(): Promise<void> {
    const url = new URL(`#/share/${shareToken}/${id}`, location.href).toString();
    await copyText(url);
    toast("Share link copied");
  }

  function renderControls(): void {
    const share = shareToken
      ? h(
          "button",
          { class: "btn outline", type: "button", onClick: () => void copyShareLink() },
          "Copy share link",
        )
      : null;
    controls.replaceChildren(
      h(
        "div",
        { class: "filters" },
        ...period.fields(),
        h("div", { class: "field" }, h("label", null, "Photos"), photosToggle.root),
      ),
      h(
        "div",
        { class: "row wrap" },
        download,
        share,
        h("a", { class: "btn outline", href: `#/rabbit/${id}` }, "Back to bunny"),
      ),
      h(
        "p",
        { class: "dim small", style: { margin: "0.6rem 0 0" } },
        "Download PDF opens your browser's print dialog — choose Save as PDF.",
      ),
    );
  }

  function renderBody(): void {
    if (!bundle) return;
    const now = new Date();
    const range = period.range();
    body.replaceChildren(
      head(bundle.rabbit, range, bundle.timezone),
      ...renderReportSections({
        bundle,
        range,
        includePhotos,
        showCost,
        showCarers: isAdmin,
        now,
        photoUrl: reportPhotoUrl,
      }),
    );
  }

  async function load(): Promise<void> {
    try {
      const [report, settingsResponse] = await Promise.all([
        api.get<ReportBundleDto>(`/api/rabbits/${id}/report`),
        api.get<{ settings: SettingsDto }>("/api/settings"),
      ]);
      bundle = report;
      shareToken = settingsResponse.settings.shareToken;
      document.title = `${report.rabbit.name} report`;
      renderControls();
      renderBody();
    } catch (err) {
      body.replaceChildren(
        h("div", { class: "empty" }, err instanceof Error ? err.message : "Could not load this report."),
      );
    }
  }

  renderControls();
  body.append(h("div", { class: "empty" }, "Loading report…"));
  void load();

  return h("section", { class: "stack" }, controls, body);
}

function head(rabbit: RabbitDto, range: ReportRange, timezone: string | undefined): HTMLElement {
  return h(
    "div",
    { class: "card report-head" },
    h(
      "div",
      { class: "row wrap", style: { alignItems: "flex-start" } },
      rabbitAvatar(rabbit, "lg"),
      h(
        "div",
        { class: "stack", style: { gap: "0.25rem" } },
        h("h1", { style: { margin: 0 } }, rabbit.name),
        h("p", { class: "dim small", style: { margin: 0 } }, rangeLabel(range, timezone)),
      ),
    ),
    h(
      "p",
      { class: "dim small", style: { margin: "0.6rem 0 0" } },
      `Generated ${fmtDate(new Date(), timezone)}`,
    ),
  );
}

function rangeLabel(range: ReportRange, timezone: string | undefined): string {
  if (!range.from && !range.to) return "All time";
  const from = range.from ? fmtDate(range.from, timezone) : "Beginning";
  const to = range.to ? fmtDate(range.to, timezone) : "Today";
  return `${from} – ${to}`;
}

function profileSection(bundle: ReportBundleDto, showCarers: boolean): HTMLElement {
  const rabbit = bundle.rabbit;
  const min = rabbit.targetWeightMinGrams;
  const max = rabbit.targetWeightMaxGrams;
  const target =
    min != null || max != null
      ? `${min != null ? formatWeight(min) : "?"} – ${max != null ? formatWeight(max) : "?"}`
      : "—";
  const rows: [string, string][] = [
    ["Sex", sexLabel(rabbit.sex)],
    ["Age", ageLabel(rabbit.dateOfBirth)],
    ["Born", fmtCalendarDate(rabbit.dateOfBirth)],
    ["Breed", rabbit.breed || "—"],
    ["Colour", rabbit.colour || "—"],
    ["Microchip", rabbit.microchip || "—"],
    ["Desexed", rabbit.desexed ? "Yes" : "No"],
    ["Status", rabbit.status === "deceased" ? "Deceased" : "Active"],
    [
      "Quarantine",
      rabbit.quarantined
        ? `Yes${rabbit.quarantineUntil ? ` until ${fmtCalendarDate(rabbit.quarantineUntil)}` : ""}`
        : "No",
    ],
    ["Target weight", target],
    ["Bonded with", bundle.bonds.length > 0 ? bundle.bonds.map((bond) => bond.name).join(", ") : "None"],
  ];
  if (showCarers) {
    rows.push([
      "Carers",
      bundle.carers.length > 0
        ? bundle.carers.map((carer) => carer.displayName || carer.username).join(", ")
        : "None",
    ]);
  }
  return section(
    "Profile",
    h(
      "dl",
      { class: "detail-list" },
      rows.flatMap(([label, value]) => [h("dt", null, label), h("dd", null, value)]),
    ),
    rabbit.feedingPlan ? h("h3", null, "Feeding plan") : null,
    rabbit.feedingPlan ? h("p", { class: "report-prose" }, rabbit.feedingPlan) : null,
    rabbit.notes ? h("h3", null, "Notes") : null,
    rabbit.notes ? h("p", { class: "report-prose" }, rabbit.notes) : null,
    rabbit.status === "deceased" && rabbit.deceasedReason
      ? h("p", { class: "dim small", style: { marginBottom: 0 } }, `Cause: ${rabbit.deceasedReason}`)
      : null,
  );
}

function weightSection(
  rabbit: RabbitDto,
  checks: HealthCheckDto[],
  range: ReportRange,
  timezone: string | undefined,
): HTMLElement {
  const inRange = checks.filter((check) => isWithinRange(check.checkedAt, range));
  const trend = weightTrend(inRange);
  if (trend.latest === null) {
    return section("Weight", empty("No weights recorded in this period."));
  }
  const min = rabbit.targetWeightMinGrams;
  const max = rabbit.targetWeightMaxGrams;
  const outside = (min != null && trend.latest < min) || (max != null && trend.latest > max);
  const change = trend.changeFromFirst;
  return section(
    "Weight",
    h(
      "div",
      { class: "stat-row report-stats" },
      metric(formatWeight(trend.latest), "Latest"),
      metric(change != null ? `${change > 0 ? "+" : ""}${formatWeight(change)}` : "—", "Change in period"),
      metric(formatWeight(trend.min), "Lowest"),
      metric(formatWeight(trend.max), "Highest"),
      metric(formatWeight(trend.average), "Average"),
    ),
    renderWeightChart(inRange, timezone),
    min != null || max != null
      ? h(
          "p",
          { class: "dim small", style: { margin: "0.5rem 0 0" } },
          `Target: ${min != null ? formatWeight(min) : "?"} – ${max != null ? formatWeight(max) : "?"}`,
          outside ? h("span", { class: "badge watch", style: { marginLeft: "0.5rem" } }, "Outside target") : null,
        )
      : null,
  );
}

function checksSection(
  checks: HealthCheckDto[],
  sections: ChecklistSectionDto[],
  logTypes: CheckLogTypeDto[],
  range: ReportRange,
  includePhotos: boolean,
  timezone: string | undefined,
  photoUrl: (kind: ReportPhotoKind, id: number) => string,
): HTMLElement {
  const inRange = checks.filter((check) => isWithinRange(check.checkedAt, range));
  if (inRange.length === 0) {
    return section("Health checks", empty("No health checks in this period."));
  }
  const headers = ["Date", "Weight", "Findings", "Checklist", "Notes"];
  if (includePhotos) headers.push("Photo");
  const rows = inRange.map((check) => {
    const cells: Child[] = [
      h(
        "div",
        null,
        fmtDate(check.checkedAt, timezone),
        h("div", { class: "dim small" }, fmtTime(check.checkedAt, timezone)),
      ),
      h("span", { class: "mono" }, formatWeight(check.weightGrams)),
      findingsText(check),
      checklistText(check, sections, logTypes),
      check.notes || "—",
    ];
    if (includePhotos) {
      cells.push(
        check.hasPhoto
          ? reportPhotos([{ src: photoUrl("check", check.id), alt: "Check photo" }])
          : "—",
      );
    }
    return cells;
  });
  return section("Health checks", reportTable(headers, rows));
}

function dailyChecksSection(
  logs: CheckLogDto[],
  range: ReportRange,
  includePhotos: boolean,
  timezone: string | undefined,
  photoUrl: (kind: ReportPhotoKind, id: number) => string,
): HTMLElement {
  const inRange = logs.filter((log) => isWithinRange(log.loggedAt, range));
  if (inRange.length === 0) {
    return section("Daily checks", empty("No daily checks in this period."));
  }
  const headers = ["Date", "Type", "Value", "Notes"];
  if (includePhotos) headers.push("Photo");
  const rows = inRange.map((log) => {
    const cells: Child[] = [
      h(
        "div",
        null,
        fmtDate(log.loggedAt, timezone),
        h("div", { class: "dim small" }, fmtTime(log.loggedAt, timezone)),
      ),
      log.typeLabel,
      checkLogValueSummary(log) || "—",
      log.notes || "—",
    ];
    if (includePhotos) {
      cells.push(
        log.photos.length > 0
          ? reportPhotos(
              log.photos.map((photo) => ({
                src: photoUrl("checklog", photo.id),
                alt: photo.caption || "Daily check photo",
              })),
            )
          : "—",
      );
    }
    return cells;
  });
  return section("Daily checks", reportTable(headers, rows));
}

function bowlsSection(
  bowls: BowlDto[],
  range: ReportRange,
  timezone: string | undefined,
): HTMLElement {
  if (bowls.length === 0) {
    return section("Food & water", empty("No bowls tracked."));
  }
  const chart = renderBowlsChart(bowls, range);
  return section(
    "Food & water",
    chart,
    h(
      "div",
      { class: "stack" },
      bowls.map((bowl) => {
        const parts = [
          bowl.periodStartAt ? `Since ${fmtDate(bowl.periodStartAt, timezone)}` : null,
          bowl.currentWeightGrams != null ? `${bowl.currentWeightGrams} g now` : null,
          `${bowl.periodConsumptionGrams} g consumed`,
          bowl.periodRefillGrams > 0 ? `${bowl.periodRefillGrams} g topped up` : null,
        ].filter(Boolean);
        const readings = bowl.readings.filter((reading) => isWithinRange(reading.readAt, range));
        return h(
          "div",
          { class: "stack", style: { gap: "0.4rem" } },
          h(
            "div",
            null,
            h("strong", null, bowl.label),
            h("div", { class: "dim small" }, parts.join(" · ")),
          ),
          readings.length > 0
            ? reportTable(
                ["Date", "Reading", "Weight", "Change", "Notes"],
                readings.map((reading) => [
                  h(
                    "div",
                    null,
                    fmtDate(reading.readAt, timezone),
                    h("div", { class: "dim small" }, fmtTime(reading.readAt, timezone)),
                  ),
                  bowlReadingKindLabel(reading.kind),
                  `${reading.weightGrams} g`,
                  reading.consumptionGrams > 0
                    ? `-${reading.consumptionGrams} g`
                    : reading.refillGrams > 0
                      ? `+${reading.refillGrams} g`
                      : "—",
                  reading.notes || "—",
                ]),
              )
            : empty("No readings in this period."),
        );
      }),
    ),
  );
}

function tasksSection(
  tasks: TaskDto[],
  completions: TaskCompletionDto[],
  range: ReportRange,
  now: Date,
  timezone: string | undefined,
): HTMLElement {
  const inRange = completions.filter((completion) => isWithinRange(completion.completedAt, range));
  if (tasks.length === 0 && inRange.length === 0) {
    return section("Daily routine", empty("No routine tasks."));
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const sorted = [...tasks].sort(
    (a, b) => TASK_SLOTS.indexOf(a.slot) - TASK_SLOTS.indexOf(b.slot) || a.id - b.id,
  );
  const rows = sorted.map((task) => {
    const dueOn = taskNextDueOn(task.startDate, task.lastCompletedAt, task.intervalDays, timezone);
    const due =
      taskDueStatus(task.startDate, task.lastCompletedAt, task.intervalDays, now, timezone) === "due";
    return [
      h(
        "div",
        null,
        h("strong", null, task.label),
        task.notes ? h("div", { class: "dim small" }, task.notes) : null,
      ),
      TASK_SLOT_LABELS[task.slot],
      task.intervalDays === 1 ? "Every day" : `Every ${task.intervalDays} days`,
      task.lastCompletedAt ? fmtDate(task.lastCompletedAt, timezone) : "Never",
      dueOn ? fmtCalendarDate(dueOn) : "—",
      task.active
        ? h("span", { class: `badge ${due ? "watch" : "ok"}` }, due ? "Due" : "Upcoming")
        : h("span", { class: "badge" }, "Inactive"),
    ];
  });
  const children: Child[] = [
    reportTable(["Task", "Slot", "Repeat", "Last done", "Next due", "Status"], rows),
  ];
  if (inRange.length > 0) {
    children.push(
      h("h3", null, "Completions in period"),
      reportTable(
        ["Date", "Task", "Notes"],
        inRange.map((completion) => [
          h(
            "div",
            null,
            fmtDate(completion.completedAt, timezone),
            h("div", { class: "dim small" }, fmtTime(completion.completedAt, timezone)),
          ),
          taskById.get(completion.taskId)?.label ?? "Task",
          completion.notes || "—",
        ]),
      ),
    );
  }
  return section("Daily routine", ...children);
}

function stagesSection(
  stages: GrowthStageDto[],
  completions: RabbitStageCompletionDto[],
  timezone: string | undefined,
): HTMLElement {
  if (completions.length === 0) {
    return section("Growth stages", empty("No growth stages recorded."));
  }
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const rows = [...completions]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((completion) => [
      h("strong", null, stageById.get(completion.stageId)?.label ?? "Stage"),
      fmtCalendarDate(completion.completedAt),
      completion.notes || "—",
    ]);
  return section("Growth stages", reportTable(["Stage", "Done", "Notes"], rows));
}

function medicationSection(
  logs: MedicationLogDto[],
  drugs: DrugDto[],
  range: ReportRange,
  timezone: string | undefined,
): HTMLElement {
  const inRange = logs.filter((log) => isWithinRange(log.givenAt, range));
  if (inRange.length === 0) {
    return section("Medication log", empty("No doses logged in this period."));
  }
  const rows = inRange.map((log) => {
    const drug = drugs.find((item) => item.id === log.drugId);
    return [
      h(
        "div",
        null,
        fmtDate(log.givenAt, timezone),
        h("div", { class: "dim small" }, fmtTime(log.givenAt, timezone)),
      ),
      drug?.name ?? "Medication",
      log.slot ? DAY_SLOT_LABELS[log.slot] : "—",
      log.amountMilliUnits != null ? formatDrugAmount(log.amountMilliUnits, drug?.unit ?? "dose") : "—",
      log.notes || "—",
    ];
  });
  return section(
    "Medication log",
    reportTable(["Date", "Medication", "Time of day", "Amount", "Notes"], rows),
  );
}

function treatmentsSection(
  treatments: TreatmentDto[],
  logs: MedicationLogDto[],
  range: ReportRange,
  now: Date,
): HTMLElement {
  const inRange = treatments.filter((treatment) =>
    dateRangesOverlap(treatment.startDate, treatment.endDate, range, now),
  );
  if (inRange.length === 0) {
    return section("Treatments", empty("No treatments in this period."));
  }
  const rows = inRange.map((treatment) => {
    const treatmentLogs = logs.filter((log) => log.treatmentId === treatment.id);
    const schedule = treatmentScheduleStatus(treatment, treatmentLogs, now);
    return [
      h(
        "div",
        null,
        h("strong", null, treatment.medication),
        treatment.notes ? h("div", { class: "dim small" }, treatment.notes) : null,
      ),
      [treatment.dose, treatment.route].filter(Boolean).join(" · ") || "—",
      treatment.frequency || "—",
      treatment.slots.map((slot) => DAY_SLOT_LABELS[slot]).join(", ") || "—",
      treatment.reason || "—",
      `${fmtCalendarDate(treatment.startDate)} → ${
        treatment.endDate ? fmtCalendarDate(treatment.endDate) : "ongoing"
      }`,
      h(
        "span",
        { class: `badge ${treatment.status === "active" ? "accent" : ""}` },
        treatment.status,
      ),
      scheduleBadge(schedule),
    ];
  });
  return section(
    "Treatments",
    reportTable(
      ["Medication", "Dose", "Frequency", "Times", "Reason", "Dates", "Status", "Schedule"],
      rows,
    ),
  );
}

function vaccinationsSection(
  vaccinations: VaccinationDto[],
  range: ReportRange,
  now: Date,
): HTMLElement {
  const inRange = vaccinations.filter(
    (vaccination) =>
      isDateWithinRange(vaccination.givenAt, range) || isDateWithinRange(vaccination.nextDueAt, range),
  );
  if (inRange.length === 0) {
    return section("Vaccinations", empty("No vaccinations in this period."));
  }
  const rows = inRange.map((vaccination) => [
    vaccination.vaccine,
    fmtCalendarDate(vaccination.givenAt),
    vaccination.nextDueAt ? fmtCalendarDate(vaccination.nextDueAt) : "—",
    vaccination.vet || "—",
    vaccination.batch || "—",
    dueBadge(dueStatus(vaccination.nextDueAt, now, 30)) ?? "—",
  ]);
  return section(
    "Vaccinations",
    reportTable(["Vaccine", "Given", "Next due", "Vet", "Batch", "Status"], rows),
  );
}

function careSection(
  schedules: CareScheduleDto[],
  records: CareRecordDto[],
  careTypes: LookupDto[],
  range: ReportRange,
  now: Date,
): HTMLElement {
  if (careTypes.length === 0) {
    return section("Routine care", empty("No care types configured."));
  }
  const rows = careTypes.map((careType) => {
    const kind = careType.value;
    const schedule = schedules.find((item) => item.kind === kind);
    const done = records
      .filter((record) => record.kind === kind)
      .sort((a, b) => b.doneAt.localeCompare(a.doneAt));
    const last = done[0];
    const intervalDays = schedule?.intervalDays ?? 0;
    const due = last ? nextDueDate(last.doneAt, intervalDays) : null;
    const inRange = done.filter((record) => isDateWithinRange(record.doneAt, range));
    return [
      careType.label,
      schedule ? `Every ${schedule.intervalDays} days` : "No schedule",
      last ? fmtCalendarDate(last.doneAt) : "Never",
      due ? fmtCalendarDate(due) : "—",
      dueBadge(careDueStatus(last?.doneAt ?? null, intervalDays, now, 7)) ?? "—",
      inRange.length > 0 ? inRange.map((record) => fmtCalendarDate(record.doneAt)).join(", ") : "—",
    ];
  });
  return section(
    "Routine care",
    reportTable(["Type", "Schedule", "Last done", "Next due", "Status", "Done in period"], rows),
  );
}

function appointmentsSection(
  appointments: AppointmentDto[],
  range: ReportRange,
  showCost: boolean,
  timezone: string | undefined,
  now: Date,
): HTMLElement {
  const upcomingByVet = new Map<string, AppointmentDto>();
  for (const appointment of [...appointments]
    .filter(
      (item) =>
        item.status === "scheduled" && new Date(item.scheduledAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
    const vet = appointment.vet || appointment.clinic || "Unassigned";
    if (!upcomingByVet.has(vet)) upcomingByVet.set(vet, appointment);
  }
  const nextBlock =
    upcomingByVet.size > 0
      ? h(
          "div",
          { class: "calc-box" },
          h("strong", null, "Next appointment per vet"),
          ...[...upcomingByVet.entries()].map(([vet, appointment]) =>
            h(
              "div",
              { class: "row wrap", style: { gap: "0.4rem", alignItems: "center" } },
              h("span", { class: "badge accent" }, vet),
              h("span", null, appointment.title),
              h(
                "span",
                { class: "mono small" },
                `${fmtDate(appointment.scheduledAt, timezone)} ${fmtTime(appointment.scheduledAt, timezone)}`,
              ),
              appointment.clinic && appointment.vet
                ? h("span", { class: "dim small" }, `· ${appointment.clinic}`)
                : null,
            ),
          ),
        )
      : null;

  const inRange = appointments
    .filter((appointment) => isWithinRange(appointment.scheduledAt, range))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  if (inRange.length === 0 && !nextBlock) {
    return section("Appointments", empty("No appointments in this period."));
  }
  const headers = ["Date", "Title", "Clinic / vet", "Status"];
  if (showCost) headers.push("Cost");
  const rows = inRange.map((appointment) => {
    const cells: Child[] = [
      h(
        "div",
        null,
        fmtDate(appointment.scheduledAt, timezone),
        h("div", { class: "dim small" }, fmtTime(appointment.scheduledAt, timezone)),
      ),
      appointment.title,
      [appointment.clinic, appointment.vet].filter(Boolean).join(" · ") || "—",
      h(
        "span",
        { class: `badge ${appointment.status === "scheduled" ? "accent" : ""}` },
        appointment.status,
      ),
    ];
    if (showCost) {
      cells.push(appointment.costCents != null ? `$${(appointment.costCents / 100).toFixed(2)}` : "—");
    }
    return cells;
  });
  return section(
    "Appointments",
    nextBlock,
    inRange.length > 0
      ? reportTable(headers, rows)
      : empty("No appointments in this period."),
  );
}

function journalSection(
  entries: JournalEntryDto[],
  range: ReportRange,
  includePhotos: boolean,
  timezone: string | undefined,
  photoUrl: (kind: ReportPhotoKind, id: number) => string,
): HTMLElement {
  const inRange = entries.filter((entry) => isWithinRange(entry.createdAt, range));
  if (inRange.length === 0) {
    return section("Notes & photos", empty("No journal entries in this period."));
  }
  return section(
    "Notes & photos",
    h(
      "div",
      { class: "journal-list" },
      inRange.map((entry) =>
        h(
          "div",
          { class: "journal-entry" },
          h(
            "div",
            { class: "journal-head" },
            h("strong", null, fmtDate(entry.createdAt, timezone)),
            h("span", { class: "dim small" }, fmtTime(entry.createdAt, timezone)),
          ),
          entry.note ? h("p", { class: "journal-note" }, entry.note) : null,
          includePhotos && entry.photos.length > 0
            ? reportPhotos(
                entry.photos.map((photo) => ({
                  src: photoUrl("journal", photo.id),
                  alt: photo.caption || "Journal photo",
                })),
              )
            : null,
        ),
      ),
    ),
  );
}

function section(title: string, ...children: Child[]): HTMLElement {
  return h("div", { class: "card report-section" }, h("h2", null, title), ...children);
}

function empty(text: string): HTMLElement {
  return h("p", { class: "dim small", style: { margin: 0 } }, text);
}

function metric(value: string, label: string): HTMLElement {
  return h(
    "div",
    { class: "metric" },
    h("span", { class: "value" }, value),
    h("span", { class: "label" }, label),
  );
}

function reportTable(headers: string[], rows: Child[][]): HTMLElement {
  return h(
    "div",
    { class: "tbl-wrap" },
    h(
      "table",
      { class: "tbl" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          headers.map((header) => h("th", null, header)),
        ),
      ),
      h(
        "tbody",
        null,
        rows.map((cells) => h("tr", null, cells.map((cell) => h("td", null, cell)))),
      ),
    ),
  );
}

function reportPhotos(photos: { src: string; alt: string }[]): HTMLElement {
  return h(
    "div",
    { class: "report-photos" },
    photos.map((photo) => h("img", { class: "report-photo", src: photo.src, alt: photo.alt })),
  );
}

function findingsText(check: HealthCheckDto): string {
  const parts: string[] = [];
  if (check.appetite) parts.push(`Appetite ${check.appetite}`);
  if (check.droppings) parts.push(`Droppings ${check.droppings}`);
  if (check.energy) parts.push(`Energy ${check.energy}`);
  if (check.bodyCondition) parts.push(`Condition ${check.bodyCondition}/5`);
  if (check.temperatureTenthsC != null) parts.push(`${(check.temperatureTenthsC / 10).toFixed(1)}°C`);
  if (check.painScore != null) parts.push(`Pain ${check.painScore}/10`);
  return parts.join(" · ") || "—";
}

function checklistText(
  check: HealthCheckDto,
  sections: ChecklistSectionDto[],
  logTypes: CheckLogTypeDto[],
): string {
  return checklistAnswerLines(check.checklist ?? {}, sections, logTypes).join(" · ") || "—";
}

function dueBadge(status: ReturnType<typeof dueStatus>): Node | null {
  if (status === "overdue") return h("span", { class: "badge alert" }, "Overdue");
  if (status === "due-soon") return h("span", { class: "badge watch" }, "Due soon");
  if (status === "ok") return h("span", { class: "badge ok" }, "OK");
  return null;
}

function scheduleBadge(state: ReturnType<typeof treatmentScheduleStatus>): HTMLElement {
  if (state === "completed") return h("span", { class: "badge ok" }, "Completed");
  if (state === "up-to-date") return h("span", { class: "badge ok" }, "Up to date");
  if (state === "missed") return h("span", { class: "badge alert" }, "Missed dose");
  if (state === "not-started") return h("span", { class: "badge" }, "Not started");
  return h("span", { class: "badge watch" }, "Dose due");
}

function nextDueDate(lastDoneAt: string | null, intervalDays: number): string | null {
  if (!lastDoneAt || intervalDays <= 0) return null;
  const date = new Date(`${lastDoneAt}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + intervalDays);
  return date.toISOString().slice(0, 10);
}
