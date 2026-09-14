import type {
  AppointmentDto,
  CalendarEventDto,
  CalendarSubscriptionDto,
  CalendarSyncResultDto,
  RabbitDto,
  SettingsDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openAppointmentModal } from "../components/appointmentModal.ts";
import { toast } from "../components/toast.ts";
import { openTreatmentModal } from "../components/treatmentModal.ts";
import type { PageContext } from "../context.ts";
import { fmtDate, fmtTime, h } from "../dom.ts";
import { can } from "../permissions.ts";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function renderCalendarPage(ctx: PageContext): HTMLElement {
  const view = new Date();
  view.setDate(1);
  let timezone: string | undefined;
  let rabbits: RabbitDto[] = [];
  const canManage = can(ctx.user, "canManageCalendar");
  const canRecord = can(ctx.user, "canRecordHealth");
  const showCost = can(ctx.user, "canViewCosts");

  const title = h("h2", { style: { margin: 0 } }, "");
  const info = h("p", { class: "dim small" });
  const grid = h("div", { class: "cal-grid" });
  const sync = h("button", { class: "btn outline small", onClick: () => void runSync() }, "Sync now");
  const newAppointment = h(
    "button",
    {
      class: "btn primary small",
      onClick: () => openAppointmentModal({ rabbits, showCost, onSaved: () => void refresh() }),
    },
    "+ New appointment",
  );

  async function runSync(): Promise<void> {
    sync.disabled = true;
    try {
      const response = await api.post<{ totals: CalendarSyncResultDto }>("/api/calendar/sync");
      toast(
        `Synced: ${response.totals.added} added, ${response.totals.updated} updated, ${response.totals.removed} removed`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      info.textContent = message;
      toast(message, "error");
    } finally {
      sync.disabled = false;
      await loadSettings();
      await refresh();
    }
  }

  async function loadSettings(): Promise<void> {
    if (!canManage) {
      const { settings } = await api.get<{ settings: SettingsDto }>("/api/settings");
      timezone = settings.timezone;
      info.textContent = "";
      return;
    }
    const [{ settings }, { subscriptions }] = await Promise.all([
      api.get<{ settings: SettingsDto }>("/api/settings"),
      api.get<{ subscriptions: CalendarSubscriptionDto[] }>("/api/calendar/subscriptions"),
    ]);
    timezone = settings.timezone;
    const parts: string[] = [];
    if (subscriptions.length === 0) {
      parts.push("No external calendars connected");
    } else {
      parts.push(`${subscriptions.length} external calendar${subscriptions.length === 1 ? "" : "s"}`);
      const latest = subscriptions
        .map((subscription) => subscription.lastSyncAt)
        .filter((value): value is string => value !== null)
        .sort()
        .pop();
      if (latest) parts.push(`Last sync ${fmtDate(latest, timezone)}`);
      const errors = subscriptions.filter((subscription) => subscription.syncError).length;
      if (errors > 0) parts.push(`${errors} sync error${errors === 1 ? "" : "s"}`);
    }
    info.textContent = parts.join(" · ");
  }

  async function refresh(): Promise<void> {
    const from = new Date(view.getFullYear(), view.getMonth(), 1);
    const to = new Date(view.getFullYear(), view.getMonth() + 1, 0, 23, 59, 59, 999);
    title.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(view);
    const [eventsRes, appointmentsRes, treatmentsRes] = await Promise.all([
      api.get<{ events: CalendarEventDto[] }>(
        `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ appointments: AppointmentDto[] }>(
        `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ treatments: TreatmentDto[] }>("/api/treatments"),
    ]);
    const monthStart = dayKey(from);
    const monthEnd = dayKey(to);
    const monthTreatments = treatmentsRes.treatments.filter(
      (treatment) =>
        treatment.status === "active" &&
        treatment.startDate <= monthEnd &&
        (treatment.endDate ?? treatment.startDate) >= monthStart,
    );
    renderGrid(eventsRes.events, appointmentsRes.appointments, monthTreatments);
  }

  function renderGrid(
    events: CalendarEventDto[],
    appointments: AppointmentDto[],
    treatments: TreatmentDto[],
  ): void {
    const eventsByDay = groupByDay(events, (event) => event.startAt);
    const appointmentsByDay = groupByDay(appointments, (appointment) => appointment.scheduledAt);
    const rabbitNames = new Map(rabbits.map((rabbit) => [rabbit.id, rabbit.name]));
    grid.replaceChildren();
    for (const label of WEEKDAYS) grid.append(h("div", { class: "cal-head" }, label));
    const offset = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const todayKey = dayKey(new Date());
    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(view.getFullYear(), view.getMonth(), 1 - offset + index);
      const key = dayKey(date);
      const classes = ["cal-cell"];
      if (date.getMonth() !== view.getMonth()) classes.push("out");
      if (key === todayKey) classes.push("today");
      const cell = h(
        "div",
        { class: classes.join(" ") },
        h("div", { class: "day" }, String(date.getDate())),
      );
      for (const appointment of appointmentsByDay.get(key) ?? []) {
        cell.append(
          h(
            "button",
            {
              class: "cal-chip appt",
              type: "button",
              onClick: () =>
                openAppointmentModal({ rabbits, appointment, showCost, onSaved: () => void refresh() }),
            },
            `${fmtTime(appointment.scheduledAt, timezone)} ${appointment.title}`,
          ),
        );
      }
      for (const treatment of treatments) {
        const rabbitName = rabbitNames.get(treatment.rabbitId) ?? "Bunny";
        const open = () =>
          openTreatmentModal({ rabbits, treatment, onSaved: () => void refresh() });
        if (treatment.startDate === key) {
          cell.append(treatmentChip(`▶ ${rabbitName}: ${treatment.medication}`, open, canRecord));
        }
        if (
          treatment.endDate !== null &&
          treatment.endDate === key &&
          treatment.endDate !== treatment.startDate
        ) {
          cell.append(
            treatmentChip(`■ ${rabbitName}: ${treatment.medication} ends`, open, canRecord),
          );
        }
      }
      for (const event of eventsByDay.get(key) ?? []) {
        cell.append(
          h(
            "button",
            {
              class: "cal-chip",
              type: "button",
              onClick: () =>
                openAppointmentModal({
                  rabbits,
                  showCost,
                  prefill: {
                    title: event.summary,
                    scheduledAt: event.startAt,
                    location: event.location,
                    eventUid: event.uid,
                  },
                  onSaved: () => void refresh(),
                }),
            },
            event.allDay
              ? event.summary
              : `${fmtTime(event.startAt ?? undefined, timezone)} ${event.summary}`,
          ),
        );
      }
      grid.append(cell);
    }
  }

  const container = h(
    "section",
    { class: "stack" },
    h("h1", null, "Calendar"),
    h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row wrap" },
        h(
          "button",
          { class: "btn ghost small", onClick: () => { view.setMonth(view.getMonth() - 1); void refresh(); } },
          "‹",
        ),
        title,
        h(
          "button",
          { class: "btn ghost small", onClick: () => { view.setMonth(view.getMonth() + 1); void refresh(); } },
          "›",
        ),
        h(
          "button",
          {
            class: "btn outline small",
            onClick: () => {
              const now = new Date();
              view.setFullYear(now.getFullYear(), now.getMonth(), 1);
              void refresh();
            },
          },
          "Today",
        ),
        h("span", { class: "spacer" }),
        canManage ? sync : null,
        canManage ? h("a", { class: "btn ghost small", href: "#/settings" }, "Subscribe") : null,
        canRecord ? newAppointment : null,
      ),
      info,
      grid,
    ),
  );

  void (async () => {
    const { rabbits: rows } = await api.get<{ rabbits: RabbitDto[] }>("/api/rabbits");
    rabbits = rows;
    newAppointment.disabled = rows.length === 0;
    await loadSettings();
    await refresh();
  })();

  return container;
}

function groupByDay<T>(items: T[], getValue: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = getValue(item);
    if (!value) continue;
    const key = dayKey(new Date(value));
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function treatmentChip(label: string, onClick: () => void, clickable: boolean): HTMLElement {
  if (!clickable) return h("span", { class: "cal-chip med" }, label);
  return h("button", { class: "cal-chip med", type: "button", onClick }, label);
}
