import type {
  AppointmentDto,
  CheckLogTypeDto,
  DrugDto,
  HealthCheckDto,
  MedicationLogDto,
  RabbitSummaryDto,
  TaskDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { ageLabel, taskDueStatus, upcomingAppointments } from "../../../shared/health.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { DAY_SLOT_LABELS } from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { loadCheckLogTypes } from "../dailyLogs.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { openCheckLogModal } from "../components/checkLogModal.ts";
import { openCheckModal } from "../components/checkModal.ts";
import { openMedicationLogModal } from "../components/medicationLogModal.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
import { slotChips } from "../components/slotChips.ts";
import { toast } from "../components/toast.ts";
import { weightAlertBadge, weightSummaryLine } from "../components/weightChip.ts";
import type { PageContext } from "../context.ts";
import { fmtDate, fmtTime, h } from "../dom.ts";
import { can } from "../permissions.ts";
import { sexLabel } from "./bunnies.ts";

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
  const fab = h("button", { class: "fab", type: "button", onClick: () => void openQuickLog() });
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Log a check</span>';
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
      { tasks },
      { logs: medLogs },
    ] = await Promise.all([
      api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits"),
      api.get<{ appointments: AppointmentDto[] }>("/api/appointments"),
      api.get<{ treatments: TreatmentDto[] }>("/api/treatments"),
      api.get<{ drugs: DrugDto[] }>("/api/drugs"),
      loadCheckLogTypes(),
      api.get<{ tasks: TaskDto[] }>("/api/tasks"),
      api.get<{ logs: MedicationLogDto[] }>("/api/medication-logs"),
    ]);
    const hasActive = rabbits.some((rabbit) => rabbit.status === "active");
    quickLog.disabled = !hasActive;
    fab.disabled = !hasActive;
    renderStats(rabbits, appointments, treatments);
    renderToday(rabbits, appointments, treatments, drugs, logTypes, tasks, medLogs);
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
    medLogs: MedicationLogDto[],
  ): void {
    const activeRabbits = rabbits.filter((rabbit) => rabbit.status === "active");
    const byId = new Map(activeRabbits.map((rabbit) => [rabbit.id, rabbit]));
    const todayKey = localDayKey(new Date());
    const rows: HTMLElement[] = [];

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
          taskDueStatus(task.lastCompletedAt, task.intervalDays, new Date()) === "due",
      )
      .sort(
        (a, b) => TASK_SLOTS.indexOf(a.slot) - TASK_SLOTS.indexOf(b.slot) || a.id - b.id,
      );
    for (const task of dueTasks) {
      const rabbit = byId.get(task.rabbitId)!;
      const detail = TASK_SLOT_LABELS[task.slot];
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
        (treatment.endDate === null || treatment.endDate >= todayKey),
    );
    for (const treatment of activeTreatments) {
      const rabbit = byId.get(treatment.rabbitId)!;
      const detail = [treatment.dose, treatment.frequency, treatment.reason]
        .filter(Boolean)
        .join(" · ");
      const todayLogs = medLogs.filter(
        (log) =>
          log.treatmentId === treatment.id &&
          localDayKey(new Date(log.givenAt)) === todayKey,
      );
      const chips = slotChips({
        slots: treatment.slots,
        logs: todayLogs,
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
        rows.push(
          h(
            "div",
            { class: "list-row" },
            h("span", { class: "badge" }, "Check"),
            h(
              "div",
              { class: "stack", style: { gap: "0" } },
              h("strong", null, "Daily check"),
              h("span", { class: "dim small" }, rabbit.name),
            ),
            h("span", { class: "spacer" }),
            h(
              "button",
              {
                class: "btn outline small",
                type: "button",
                onClick: () => openCheckLogModal({ rabbit, types: logTypes, onSaved: () => void load() }),
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
    try {
      await api.post(`/api/tasks/${task.id}/complete`, {
        completedAt: new Date().toISOString(),
        notes: "",
      });
      toast("Done");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete the task", "error");
    }
  }

  void load();
  return container;
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
