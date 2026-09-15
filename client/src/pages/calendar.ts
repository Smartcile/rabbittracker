import { expandEntryStart } from "../../../shared/calendar.ts";
import { checkLogValueSummary } from "../../../shared/checkLogs.ts";
import { DAY_SLOT_SHORT_LABELS, allSlotsDone, slotStatus } from "../../../shared/slots.ts";
import type {
  AppointmentDto,
  BowlDto,
  CalendarEntryDto,
  CalendarEventDto,
  CalendarSubscriptionDto,
  CalendarSyncResultDto,
  CheckLogDto,
  DrugDto,
  FoodProductDto,
  MedicationLogDto,
  RabbitDto,
  SettingsDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openAppointmentModal } from "../components/appointmentModal.ts";
import { openBowlReadingModal } from "../components/bowlModal.ts";
import { openCalendarEntryModal } from "../components/calendarEntryModal.ts";
import { openMedicationLogModal } from "../components/medicationLogModal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { fmtDate, fmtTime, h } from "../dom.ts";
import { can } from "../permissions.ts";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function renderCalendarPage(ctx: PageContext): HTMLElement {
  const view = new Date();
  view.setDate(1);
  let timezone: string | undefined;
  let rabbits: RabbitDto[] = [];
  let drugs: DrugDto[] = [];
  let foodProducts: FoodProductDto[] = [];
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
  const newEvent = h(
    "button",
    {
      class: "btn outline small",
      onClick: () => openCalendarEntryModal({ rabbits, onSaved: () => void refresh() }),
    },
    "+ New event",
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
    const [
      eventsRes,
      appointmentsRes,
      treatmentsRes,
      entriesRes,
      logsRes,
      medLogsRes,
      drugsRes,
      bowlScheduleRes,
      foodRes,
    ] = await Promise.all([
      api.get<{ events: CalendarEventDto[] }>(
        `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ appointments: AppointmentDto[] }>(
        `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ treatments: TreatmentDto[] }>("/api/treatments"),
      api.get<{ entries: CalendarEntryDto[] }>(
        `/api/calendar-entries?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ logs: CheckLogDto[] }>(
        `/api/check-logs?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ logs: MedicationLogDto[] }>(
        `/api/medication-logs?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ drugs: DrugDto[] }>("/api/drugs"),
      api.get<{ bowls: BowlDto[] }>(
        `/api/bowls/schedule?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api.get<{ products: FoodProductDto[] }>("/api/food-products"),
    ]);
    drugs = drugsRes.drugs;
    foodProducts = foodRes.products;
    const monthStart = dayKey(from);
    const monthEnd = dayKey(to);
    const monthTreatments = treatmentsRes.treatments.filter(
      (treatment) =>
        treatment.status === "active" &&
        treatment.startDate <= monthEnd &&
        (treatment.endDate === null || treatment.endDate >= monthStart),
    );
    const occurrences = entriesRes.entries.flatMap((entry) =>
      expandEntryStart(entry, from, to).map((at) => ({ entry, at })),
    );
    renderGrid(
      eventsRes.events,
      appointmentsRes.appointments,
      monthTreatments,
      occurrences,
      logsRes.logs,
      medLogsRes.logs,
      bowlScheduleRes.bowls,
    );
  }

  function renderGrid(
    events: CalendarEventDto[],
    appointments: AppointmentDto[],
    treatments: TreatmentDto[],
    occurrences: { entry: CalendarEntryDto; at: Date }[],
    logs: CheckLogDto[],
    medLogs: MedicationLogDto[],
    bowls: BowlDto[],
  ): void {
    const eventsByDay = groupByDay(events, (event) => event.startAt);
    const appointmentsByDay = groupByDay(appointments, (appointment) => appointment.scheduledAt);
    const entriesByDay = groupByDay(occurrences, (item) => item.at.toISOString());
    const logsByDay = groupByDay(logs, (log) => log.loggedAt);
    const medLogsByDay = groupByDay(medLogs, (log) => log.givenAt);
    const bowlReadingsByDay = new Map<string, Map<number, BowlDto["readings"]>>();
    for (const bowl of bowls) {
      for (const reading of bowl.readings) {
        const key = dayKey(new Date(reading.readAt));
        const byBowl = bowlReadingsByDay.get(key) ?? new Map();
        const list = byBowl.get(bowl.id) ?? [];
        list.push(reading);
        byBowl.set(bowl.id, list);
        bowlReadingsByDay.set(key, byBowl);
      }
    }
    const rabbitNames = new Map(rabbits.map((rabbit) => [rabbit.id, rabbit.name]));
    const rabbitById = new Map(rabbits.map((rabbit) => [rabbit.id, rabbit]));
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
        const rabbit = rabbitById.get(treatment.rabbitId);
        const rabbitName = rabbitNames.get(treatment.rabbitId) ?? "Bunny";
        const startsToday = treatment.startDate === key;
        const endsToday = treatment.endDate === key;
        const showsEnd = endsToday && treatment.endDate !== treatment.startDate;
        const activeToday =
          date.getMonth() === view.getMonth() &&
          treatment.startDate <= key &&
          (treatment.endDate === null || treatment.endDate >= key);
        if (!startsToday && !showsEnd && !activeToday) continue;
        const dayLogs = (medLogsByDay.get(key) ?? []).filter(
          (log) => log.treatmentId === treatment.id,
        );
        const statuses =
          treatment.slots.length > 0
            ? slotStatus(
                treatment.slots,
                dayLogs.map((log) => ({ slot: log.slot, at: log.givenAt })),
              )
            : [];
        const done = allSlotsDone(treatment.slots, dayLogs);
        const parts: (HTMLElement | string)[] = [];
        if (startsToday) parts.push("▶ ");
        else if (showsEnd) parts.push("■ ");
        parts.push(`${rabbitName}: ${treatment.medication}`);
        if (startsToday && treatment.frequency) parts.push(` · ${treatment.frequency}`);
        if (showsEnd) parts.push(" ends");
        if (statuses.length > 0) {
          parts.push(
            h(
              "span",
              { class: "cal-slots" },
              statuses.map((entry) =>
                h(
                  "span",
                  {
                    class: `cal-slot${entry.done ? " done" : ""}${
                      entry.status === "late" ? " late" : ""
                    }`,
                  },
                  `${DAY_SLOT_SHORT_LABELS[entry.slot]}${
                    entry.done ? (entry.status === "late" ? " !" : " ✓") : ""
                  }`,
                ),
              ),
            ),
          );
        } else if (done) {
          parts.push(h("span", { class: "cal-slot done" }, "✓"));
        }
        const open =
          canRecord && rabbit
            ? () =>
                openMedicationLogModal({
                  rabbit,
                  treatments,
                  drugs,
                  logs: medLogs,
                  treatmentId: treatment.id,
                  date: new Date(date),
                  onSaved: () => void refresh(),
                })
            : null;
        cell.append(calendarChip(parts, open, done, "med"));
      }
      for (const bowl of bowls) {
        const rabbit = rabbitById.get(bowl.rabbitId);
        const rabbitName = rabbitNames.get(bowl.rabbitId) ?? "Bunny";
        const dayReadings = bowlReadingsByDay.get(key)?.get(bowl.id) ?? [];
        const statuses = slotStatus(
          bowl.slots,
          dayReadings.map((reading) => ({ slot: reading.slot, at: reading.readAt })),
        );
        const done = allSlotsDone(bowl.slots, dayReadings);
        const parts: (HTMLElement | string)[] = [`${rabbitName}: ${bowl.label}`];
        if (statuses.length > 0) {
          parts.push(
            h(
              "span",
              { class: "cal-slots" },
              statuses.map((entry) =>
                h(
                  "span",
                  {
                    class: `cal-slot${entry.done ? " done" : ""}${
                      entry.status === "late" ? " late" : ""
                    }`,
                  },
                  `${DAY_SLOT_SHORT_LABELS[entry.slot]}${
                    entry.done ? (entry.status === "late" ? " !" : " ✓") : ""
                  }`,
                ),
              ),
            ),
          );
        } else if (done) {
          parts.push(h("span", { class: "cal-slot done" }, "✓"));
        }
        const open =
          canRecord && rabbit
            ? () =>
                openBowlReadingModal({
                  bowl,
                  mode: "weigh",
                  date: new Date(date),
                  product: foodProducts.find((item) => item.id === bowl.productId),
                  onSaved: () => void refresh(),
                })
            : null;
        cell.append(calendarChip(parts, open, done, "bowl"));
      }
      for (const { entry } of entriesByDay.get(key) ?? []) {
        const label = entry.allDay ? entry.title : `${fmtTime(entry.startAt, timezone)} ${entry.title}`;
        cell.append(
          canManage
            ? h(
                "button",
                {
                  class: "cal-chip event",
                  type: "button",
                  onClick: () =>
                    openCalendarEntryModal({ rabbits, entry, onSaved: () => void refresh() }),
                },
                label,
              )
            : h("span", { class: "cal-chip event" }, label),
        );
      }
      for (const log of logsByDay.get(key) ?? []) {
        const value = checkLogValueSummary(log);
        cell.append(
          h(
            "a",
            { class: "cal-chip log", href: `#/rabbit/${log.rabbitId}` },
            `${log.typeLabel}${value ? `: ${value}` : ""}`,
          ),
        );
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
        canManage ? newEvent : null,
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

function calendarChip(
  parts: (HTMLElement | string)[],
  onClick: (() => void) | null,
  done: boolean,
  kind: "med" | "bowl",
): HTMLElement {
  const classes = `cal-chip ${kind}${done ? " done" : ""}`;
  if (!onClick) return h("span", { class: classes }, ...parts);
  return h("button", { class: classes, type: "button", onClick }, ...parts);
}
