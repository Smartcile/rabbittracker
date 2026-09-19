import { checkLogValueSummary } from "../../../shared/checkLogs.ts";
import { formatWeight } from "../../../shared/health.ts";
import { DAY_SLOT_SHORT_LABELS, allSlotsDone, slotStatus } from "../../../shared/slots.ts";
import type { ReportBundleDto } from "../../../shared/types.ts";
import { fmtTime, h } from "../dom.ts";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export type ShareCalendar = {
  element: HTMLElement;
  setBundle: (bundle: ReportBundleDto) => void;
};

export function createShareCalendar(): ShareCalendar {
  const view = new Date();
  view.setDate(1);
  let bundle: ReportBundleDto | null = null;
  const title = h("h3", { style: { margin: 0 } }, "");
  const grid = h("div", { class: "cal-grid" });

  function render(): void {
    title.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(view);
    renderGrid();
  }

  function renderGrid(): void {
    grid.replaceChildren();
    if (!bundle) return;
    const timezone = bundle.timezone;
    const monthStart = dayKey(new Date(view.getFullYear(), view.getMonth(), 1));
    const monthEnd = dayKey(new Date(view.getFullYear(), view.getMonth() + 1, 0));

    const appointmentsByDay = groupByDay(bundle.appointments, (appointment) => appointment.scheduledAt);
    const logsByDay = groupByDay(bundle.checkLogs, (log) => log.loggedAt);
    const checksByDay = groupByDay(bundle.checks, (check) => check.checkedAt);
    const medLogsByDay = groupByDay(bundle.medicationLogs, (log) => log.givenAt);
    const treatments = bundle.treatments.filter(
      (treatment) =>
        treatment.status === "active" &&
        treatment.startDate <= monthEnd &&
        (treatment.endDate === null || treatment.endDate >= monthStart),
    );
    const bowls = bundle.bowls.filter((bowl) => bowl.slots.length > 0);
    const bowlReadingsByDay = new Map<string, Map<number, ReportBundleDto["bowls"][number]["readings"]>>();
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
            "span",
            { class: "cal-chip appt" },
            `${fmtTime(appointment.scheduledAt, timezone)} ${appointment.title}`,
          ),
        );
      }

      for (const treatment of treatments) {
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
                dayLogs.map((log) => ({ slot: log.slot, at: log.givenAt, skipped: log.skipped })),
              )
            : [];
        const done = allSlotsDone(treatment.slots, dayLogs);
        const parts: (HTMLElement | string)[] = [];
        if (startsToday) parts.push("▶ ");
        else if (showsEnd) parts.push("■ ");
        parts.push(treatment.medication);
        if (showsEnd) parts.push(" ends");
        if (statuses.length > 0) parts.push(slotChips(statuses));
        else if (done) parts.push(h("span", { class: "cal-slot done" }, "✓"));
        cell.append(h("span", { class: `cal-chip med${done ? " done" : ""}` }, ...parts));
      }

      for (const bowl of bowls) {
        const dayReadings = bowlReadingsByDay.get(key)?.get(bowl.id) ?? [];
        const statuses = slotStatus(
          bowl.slots,
          dayReadings.map((reading) => ({ slot: reading.slot, at: reading.readAt })),
        );
        const done = allSlotsDone(bowl.slots, dayReadings);
        const parts: (HTMLElement | string)[] = [bowl.label];
        if (statuses.length > 0) parts.push(slotChips(statuses));
        else if (done) parts.push(h("span", { class: "cal-slot done" }, "✓"));
        cell.append(h("span", { class: `cal-chip bowl${done ? " done" : ""}` }, ...parts));
      }

      for (const log of logsByDay.get(key) ?? []) {
        const value = checkLogValueSummary(log);
        cell.append(h("span", { class: "cal-chip log" }, `${log.typeLabel}${value ? `: ${value}` : ""}`));
      }

      for (const check of checksByDay.get(key) ?? []) {
        cell.append(
          h(
            "span",
            { class: "cal-chip check" },
            `Health check${check.weightGrams != null ? `: ${formatWeight(check.weightGrams)}` : ""}`,
          ),
        );
      }

      grid.append(cell);
    }
  }

  const prev = h(
    "button",
    { class: "btn ghost small", type: "button", onClick: () => { view.setMonth(view.getMonth() - 1); render(); } },
    "‹",
  );
  const next = h(
    "button",
    { class: "btn ghost small", type: "button", onClick: () => { view.setMonth(view.getMonth() + 1); render(); } },
    "›",
  );
  const today = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () => {
        const now = new Date();
        view.setFullYear(now.getFullYear(), now.getMonth(), 1);
        render();
      },
    },
    "Today",
  );

  const element = h(
    "div",
    { class: "card report-section" },
    h("h2", null, "Calendar"),
    h("div", { class: "row wrap" }, prev, title, next, today),
    grid,
  );
  render();

  return {
    element,
    setBundle: (nextBundle) => {
      bundle = nextBundle;
      render();
    },
  };
}

function slotChips(statuses: ReturnType<typeof slotStatus>): HTMLElement {
  return h(
    "span",
    { class: "cal-slots" },
    statuses.map((entry) =>
      h(
        "span",
        {
          class: `cal-slot${entry.done ? " done" : ""}${entry.status === "late" ? " late" : ""}${
            entry.missed ? " missed" : ""
          }`,
        },
        `${DAY_SLOT_SHORT_LABELS[entry.slot]}${
          entry.done
            ? entry.missed
              ? " ✗"
              : entry.status === "late" || entry.offSchedule
                ? " !"
                : " ✓"
            : ""
        }`,
      ),
    ),
  );
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
