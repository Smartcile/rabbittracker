import type {
  AppointmentDto,
  CheckLogDto,
  CheckLogTypeDto,
  DrugDto,
  HealthCheckDto,
  MedicationLogDto,
  RabbitSummaryDto,
  SettingsDto,
  TaskCompletionDto,
  TaskDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { ageLabel, taskDueStatus, upcomingAppointments } from "../../../shared/health.ts";
import { checkLogValueSummary } from "../../../shared/checkLogs.ts";
import { isScheduledOn, recurrenceLabel } from "../../../shared/recurrence.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { DAY_SLOT_LABELS } from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { loadCheckLogTypes } from "../dailyLogs.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { openCheckLogModal } from "../components/checkLogModal.ts";
import { openCheckModal } from "../components/checkModal.ts";
import { openMedicationLogModal } from "../components/medicationLogModal.ts";
import { openModal } from "../components/modal.ts";
import { openTaskCompleteModal } from "../components/taskCompleteModal.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
import { slotChips } from "../components/slotChips.ts";
import { toast } from "../components/toast.ts";
import { weightAlertBadge, weightSummaryLine } from "../components/weightChip.ts";
import type { PageContext } from "../context.ts";
import { fmtDate, fmtTime, h } from "../dom.ts";
import { can } from "../permissions.ts";
import { sexLabel } from "./bunnies.ts";

const QUICK_AREAS: { key: string; label: string }[] = [
  { key: "daily-checks", label: "Daily checks" },
  { key: "routine", label: "Routine" },
  { key: "bowls", label: "Food & water" },
  { key: "weight", label: "Weight" },
  { key: "health-checks", label: "Health checks" },
  { key: "vaccinations", label: "Vaccinations" },
  { key: "treatments", label: "Treatments & medication" },
  { key: "notes", label: "Notes & photos" },
  { key: "appointments", label: "Appointments" },
  { key: "feeding", label: "Feeding plan" },
  { key: "growing-up", label: "Growing up" },
];

export function renderHomePage(ctx: PageContext): HTMLElement {
  const list = h("div", { class: "grid-cards" });
  const attention = h("div", { class: "card" });
  attention.style.display = "none";
  const upcoming = h("div", { class: "card" });
  upcoming.style.display = "none";
  const canRecord = can(ctx.user, "canRecordHealth");
  const canCreate = can(ctx.user, "canCreateRabbits");
  const quickLog = h(
    "button",
    { class: "btn primary hide-mobile", onClick: () => void openQuickLog() },
    "Log a check",
  );
  const fab = h("button", { class: "fab", type: "button", onClick: () => void openQuickActions() });
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Log</span>';
  const add = h(
    "button",
    { class: "btn outline small", onClick: () => openRabbitModal({ onSaved: () => void load() }) },
    "Add bunny",
  );
  const stats = h("div", { class: "stat-row" });
  const today = h("div", { class: "card" });
  today.style.display = "none";
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card" },
      h("h1", null, `Hi ${ctx.user.displayName || ctx.user.username}`),
      h("p", { class: "dim small" }, "Track weights and health checks for your bunnies."),
      h("div", { class: "row" }, canRecord ? quickLog : null, canCreate ? add : null),
      stats,
    ),
    today,
    attention,
    upcoming,
    h("div", { class: "card-title" }, h("h2", null, "Your bunnies")),
    list,
    canRecord ? fab : null,
  );

  async function load(): Promise<void> {
    const [
      { rabbits },
      { appointments },
      { treatments },
      { drugs },
      logTypes,
      { tasks, completions: taskCompletions },
      { logs: medLogs },
      { logs: checkLogs },
      { settings },
    ] = await Promise.all([
      api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits"),
      api.get<{ appointments: AppointmentDto[] }>("/api/appointments"),
      api.get<{ treatments: TreatmentDto[] }>("/api/treatments"),
      api.get<{ drugs: DrugDto[] }>("/api/drugs"),
      loadCheckLogTypes(),
      api.get<{ tasks: TaskDto[]; completions: TaskCompletionDto[] }>("/api/tasks"),
      api.get<{ logs: MedicationLogDto[] }>("/api/medication-logs"),
      api.get<{ logs: CheckLogDto[] }>("/api/check-logs"),
      api.get<{ settings: SettingsDto }>("/api/settings"),
    ]);
    const hasActive = rabbits.some((rabbit) => rabbit.status === "active");
    quickLog.disabled = !hasActive;
    fab.disabled = !hasActive;
    renderStats(rabbits, appointments, treatments);
    renderToday(
      rabbits,
      appointments,
      treatments,
      drugs,
      logTypes,
      tasks,
      taskCompletions,
      medLogs,
      checkLogs,
      settings.timezone,
    );
    renderAttention(rabbits);
    renderUpcoming(appointments, rabbits);
    if (rabbits.length === 0) {
      list.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("strong", null, "No bunnies yet"),
          "Add your first bunny to start tracking health.",
        ),
      );
      return;
    }
    list.replaceChildren(...rabbits.map(card));
  }

  function renderStats(
    rabbits: RabbitSummaryDto[],
    appointments: AppointmentDto[],
    treatments: TreatmentDto[],
  ): void {
    const inCare = rabbits.filter((rabbit) => rabbit.status === "active").length;
    const attention = rabbits.filter((rabbit) => rabbit.badges.length > 0).length;
    const quarantine = rabbits.filter((rabbit) => rabbit.quarantined).length;
    const upcoming = upcomingAppointments(appointments, new Date(), 14).length;
    const meds = treatments.filter((treatment) => treatment.status === "active").length;
    const metric = (value: number, label: string) =>
      h(
        "div",
        { class: "metric" },
        h("span", { class: "value" }, String(value)),
        h("span", { class: "label" }, label),
      );
    stats.replaceChildren(
      metric(inCare, "In care"),
      metric(attention, "Need attention"),
      metric(upcoming, "Appointments (14 days)"),
      metric(meds, "Active treatments"),
      ...(quarantine > 0 ? [metric(quarantine, "In quarantine")] : []),
    );
  }

  function renderToday(
    rabbits: RabbitSummaryDto[],
    appointments: AppointmentDto[],
    treatments: TreatmentDto[],
    drugs: DrugDto[],
    logTypes: CheckLogTypeDto[],
    tasks: TaskDto[],
    taskCompletions: TaskCompletionDto[],
    medLogs: MedicationLogDto[],
    checkLogs: CheckLogDto[],
    timezone: string,
  ): void {
    const activeRabbits = rabbits.filter((rabbit) => rabbit.status === "active");
    const byId = new Map(activeRabbits.map((rabbit) => [rabbit.id, rabbit]));
    const todayKey = localDayKey(new Date());
    const rows: HTMLElement[] = [];
    const completionDaysByTask = new Map<number, Set<string>>();
    for (const completion of taskCompletions) {
      const set = completionDaysByTask.get(completion.taskId) ?? new Set<string>();
      set.add(localDayKey(new Date(completion.completedAt)));
      completionDaysByTask.set(completion.taskId, set);
    }
    const medDoneDaysByTreatment = new Map<number, Set<string>>();
    for (const log of medLogs) {
      if (log.treatmentId === null || log.skipped) continue;
      const set = medDoneDaysByTreatment.get(log.treatmentId) ?? new Set<string>();
      set.add(localDayKey(new Date(log.givenAt)));
      medDoneDaysByTreatment.set(log.treatmentId, set);
    }

    const todaysAppointments = appointments
      .filter(
        (appointment) =>
          appointment.status === "scheduled" &&
          localDayKey(new Date(appointment.scheduledAt)) === todayKey,
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    for (const appointment of todaysAppointments) {
      rows.push(
        h(
          "div",
          { class: "list-row" },
          h("a", { href: `#/rabbit/${appointment.rabbitId}` }, byId.get(appointment.rabbitId)?.name ?? "Bunny"),
          h("span", { class: "dim small" }, appointment.title),
          h("span", { class: "spacer" }),
          h("span", { class: "mono small" }, fmtTime(appointment.scheduledAt)),
        ),
      );
    }

    const dueTasks = tasks
      .filter(
        (task) =>
          task.active &&
          byId.has(task.rabbitId) &&
          taskDueStatus(
            task.startDate,
            task.lastCompletedAt,
            task.intervalDays,
            new Date(),
            timezone,
            task.recurrence,
            [...(completionDaysByTask.get(task.id) ?? [])],
          ) === "due",
      )
      .sort(
        (a, b) => TASK_SLOTS.indexOf(a.slot) - TASK_SLOTS.indexOf(b.slot) || a.id - b.id,
      );
    for (const task of dueTasks) {
      const rabbit = byId.get(task.rabbitId)!;
      const productsText = task.products
        .map(
          (product) =>
            `${product.productName}${product.amountGrams > 0 ? ` (${product.amountGrams} g)` : ""}`,
        )
        .join(", ");
      const detail = [
        TASK_SLOT_LABELS[task.slot],
        productsText ? `uses ${productsText}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      rows.push(
        h(
          "div",
          { class: "list-row" },
          h("span", { class: "badge accent" }, "Task"),
          h(
            "div",
            { class: "stack", style: { gap: "0" } },
            h("strong", null, task.label),
            h("span", { class: "dim small" }, `${rabbit.name}${detail ? ` · ${detail}` : ""}`),
          ),
          h("span", { class: "spacer" }),
          canRecord
            ? h(
                "button",
                {
                  class: "btn primary small",
                  type: "button",
                  onClick: () => void completeTask(task),
                },
                "Done",
              )
            : null,
        ),
      );
    }

    const activeTreatments = treatments.filter(
      (treatment) =>
        treatment.status === "active" &&
        byId.has(treatment.rabbitId) &&
        treatment.startDate <= todayKey &&
        (treatment.endDate === null || treatment.endDate >= todayKey) &&
        isScheduledOn(
          treatment.recurrence,
          todayKey,
          treatment.startDate,
          [...(medDoneDaysByTreatment.get(treatment.id) ?? [])],
        ),
    );
    for (const treatment of activeTreatments) {
      const rabbit = byId.get(treatment.rabbitId)!;
      const detail = [
        treatment.dose,
        treatment.recurrence.kind === "daily"
          ? treatment.frequency
          : recurrenceLabel(treatment.recurrence),
        treatment.reason,
      ]
        .filter(Boolean)
        .join(" · ");
      const todayLogs = medLogs.filter(
        (log) =>
          log.treatmentId === treatment.id &&
          localDayKey(new Date(log.givenAt)) === todayKey,
      );
      const chips = slotChips({
        slots: treatment.slots,
        logs: todayLogs.map((entry) => ({
          slot: entry.slot,
          at: entry.givenAt,
          skipped: entry.skipped,
        })),
        canRecord,
        onLog: (slot) =>
          openMedicationLogModal({
            rabbit,
            treatments,
            drugs,
            logs: medLogs,
            treatmentId: treatment.id,
            slot,
            date: new Date(),
            onSaved: () => void load(),
          }),
      });
      rows.push(
        h(
          "div",
          { class: "list-row" },
          h("span", { class: "badge accent" }, "Med"),
          h(
            "div",
            { class: "stack", style: { gap: "0.25rem" } },
            h("strong", null, treatment.medication),
            h("span", { class: "dim small" }, `${rabbit.name}${detail ? ` · ${detail}` : ""}`),
            chips,
          ),
          h("span", { class: "spacer" }),
          canRecord && treatment.slots.length === 0
            ? h(
                "button",
                {
                  class: "btn primary small",
                  type: "button",
                  onClick: () =>
                    openMedicationLogModal({
                      rabbit,
                      treatments,
                      drugs,
                      logs: medLogs,
                      treatmentId: treatment.id,
                      date: new Date(),
                      onSaved: () => void load(),
                    }),
                },
                "Log dose",
              )
            : null,
        ),
      );
    }

    if (canRecord && logTypes.length > 0) {
      for (const rabbit of activeRabbits) {
        const rabbitLogs = checkLogs.filter(
          (log) => log.rabbitId === rabbit.id && localDayKey(new Date(log.loggedAt)) === todayKey,
        );
        for (const log of rabbitLogs) {
          const summary = checkLogValueSummary(log);
          rows.push(
            h(
              "div",
              { class: "list-row" },
              h("span", { class: "badge" }, "Check"),
              h(
                "div",
                { class: "stack", style: { gap: "0.15rem" } },
                h("strong", null, log.typeLabel),
                h("span", { class: "dim small" }, `${rabbit.name}${summary ? ` · ${summary}` : ""}`),
              ),
              h("span", { class: "spacer" }),
              h(
                "button",
                {
                  class: "btn ghost small",
                  type: "button",
                  onClick: () =>
                    openCheckLogModal({ rabbit, types: logTypes, logs: checkLogs, log, onSaved: () => void load() }),
                },
                "Edit",
              ),
            ),
          );
        }
        rows.push(
          h(
            "div",
            { class: "list-row" },
            h("span", { class: "badge" }, "Check"),
            h(
              "div",
              { class: "stack", style: { gap: "0" } },
              h("strong", null, rabbitLogs.length > 0 ? "Add daily check" : "Daily check"),
              h("span", { class: "dim small" }, rabbit.name),
            ),
            h("span", { class: "spacer" }),
            h(
              "button",
              {
                class: "btn outline small",
                type: "button",
                onClick: () => openCheckLogModal({ rabbit, types: logTypes, logs: checkLogs, onSaved: () => void load() }),
              },
              "Log",
            ),
          ),
        );
      }
    }

    if (rows.length === 0) {
      today.style.display = "none";
      return;
    }
    today.style.display = "";
    today.replaceChildren(
      h("h2", null, "Today"),
      h(
        "p",
        { class: "dim small" },
        new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(
          new Date(),
        ),
      ),
      h("div", null, rows),
    );
  }

  function renderAttention(rabbits: RabbitSummaryDto[]): void {
    const rows = rabbits.flatMap((rabbit) =>
      rabbit.badges.map((badge) => ({ rabbit, badge })),
    );
    if (rows.length === 0) {
      attention.style.display = "none";
      return;
    }
    attention.style.display = "";
    attention.replaceChildren(
      h("h2", null, "Needs attention"),
      h(
        "div",
        null,
        rows.map(({ rabbit, badge }) =>
          h(
            "div",
            { class: "list-row" },
            h("a", { href: `#/rabbit/${rabbit.id}` }, rabbit.name),
            h("span", { class: "dim small" }, badge.label),
            h("span", { class: "spacer" }),
            h(
              "span",
              { class: `badge ${badge.severity === "alert" ? "alert" : "watch"}` },
              badge.severity === "alert" ? "Alert" : "Watch",
            ),
          ),
        ),
      ),
    );
  }

  function renderUpcoming(appointments: AppointmentDto[], rabbits: RabbitSummaryDto[]): void {
    const items = upcomingAppointments(appointments, new Date(), 14);
    if (items.length === 0) {
      upcoming.style.display = "none";
      return;
    }
    const names = new Map(rabbits.map((rabbit) => [rabbit.id, rabbit.name]));
    upcoming.style.display = "";
    upcoming.replaceChildren(
      h("h2", null, "Upcoming appointments"),
      h(
        "div",
        null,
        items.map((appointment) =>
          h(
            "div",
            { class: "list-row" },
            h("a", { href: `#/rabbit/${appointment.rabbitId}` }, names.get(appointment.rabbitId) ?? "Bunny"),
            h("span", { class: "dim small" }, appointment.title),
            h("span", { class: "spacer" }),
            h("span", { class: "mono small" }, `${fmtDate(appointment.scheduledAt)} ${fmtTime(appointment.scheduledAt)}`),
          ),
        ),
      ),
    );
  }

  function card(rabbit: RabbitSummaryDto): HTMLElement {
    return h(
      "a",
      { class: "card rabbit-card", href: `#/rabbit/${rabbit.id}` },
      rabbitAvatar(rabbit, "lg"),
      h(
        "div",
        { class: "stack", style: { gap: "0.2rem" } },
        h("strong", null, rabbit.name),
        h("span", { class: "dim small" }, `${sexLabel(rabbit.sex)} · ${ageLabel(rabbit.dateOfBirth)}`),
        weightSummaryLine(rabbit),
        h(
          "div",
          { class: "row wrap" },
          weightAlertBadge(rabbit),
          rabbit.quarantined ? h("span", { class: "badge watch" }, "Quarantine") : null,
          rabbit.status === "deceased" ? h("span", { class: "badge" }, "Deceased") : null,
          rabbit.badges
            .filter((badge) => badge.kind !== "weight")
            .slice(0, 2)
            .map((badge) =>
              h(
                "span",
                { class: `badge ${badge.severity === "alert" ? "alert" : "watch"}` },
                badge.label,
              ),
            ),
        ),
      ),
    );
  }

  async function openQuickLog(): Promise<void> {
    const { rabbits } = await api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits");
    const active = rabbits.filter((rabbit) => rabbit.status === "active");
    if (active.length === 0) return;
    openCheckModal({ rabbits: active, onSaved: (_check: HealthCheckDto) => void load() });
  }

  async function completeTask(task: TaskDto): Promise<void> {
    openTaskCompleteModal({ task, onDone: () => void load() });
  }

  void load();
  return container;
}

async function openQuickActions(): Promise<void> {
  const { rabbits } = await api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits");
  const active = rabbits.filter((rabbit) => rabbit.status === "active");
  if (active.length === 0) return;
  if (active.length === 1) {
    openAreaSheet(active[0]);
    return;
  }
  openBunnyPicker(active);
}

function openAreaSheet(rabbit: RabbitSummaryDto): void {
  const modal = openModal({
    title: `Log for ${rabbit.name}`,
    body: h(
      "div",
      { class: "stack", style: { gap: "0.4rem" } },
      ...QUICK_AREAS.map((area) =>
        h(
          "button",
          {
            class: "btn outline",
            type: "button",
            onClick: () => {
              modal.close();
              location.hash = `#/rabbit/${rabbit.id}/${area.key}`;
            },
          },
          area.label,
        ),
      ),
    ),
  });
}

function openBunnyPicker(rabbits: RabbitSummaryDto[]): void {
  const modal = openModal({
    title: "Which bunny?",
    body: h(
      "div",
      { class: "stack", style: { gap: "0.4rem" } },
      ...rabbits.map((rabbit) =>
        h(
          "button",
          {
            class: "btn outline",
            type: "button",
            onClick: () => {
              modal.close();
              openAreaSheet(rabbit);
            },
          },
          rabbit.name,
        ),
      ),
    ),
  });
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
