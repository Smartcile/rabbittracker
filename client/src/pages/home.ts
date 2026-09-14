import type {
  AppointmentDto,
  HealthCheckDto,
  RabbitSummaryDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { ageLabel, upcomingAppointments } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { openCheckModal } from "../components/checkModal.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
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
    attention,
    upcoming,
    h("div", { class: "card-title" }, h("h2", null, "Your bunnies")),
    list,
    canRecord ? fab : null,
  );

  async function load(): Promise<void> {
    const [{ rabbits }, { appointments }, { treatments }] = await Promise.all([
      api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits"),
      api.get<{ appointments: AppointmentDto[] }>("/api/appointments"),
      api.get<{ treatments: TreatmentDto[] }>("/api/treatments"),
    ]);
    const hasActive = rabbits.some((rabbit) => rabbit.status === "active");
    quickLog.disabled = !hasActive;
    fab.disabled = !hasActive;
    renderStats(rabbits, appointments, treatments);
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

  void load();
  return container;
}
