import {
  DEFAULT_RECURRENCE,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Recurrence,
  type RecurrenceKind,
  type Weekday,
} from "../../../shared/recurrence.ts";
import { h } from "../dom.ts";
import { optionButtons } from "./toggle.ts";

const KIND_OPTIONS: { value: RecurrenceKind; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Chosen days" },
  { value: "per_week", label: "Times per week" },
  { value: "interval", label: "Every N days" },
];

export function recurrenceEditor(initial: Recurrence): {
  root: HTMLElement;
  value: () => Recurrence;
  setValue: (next: Recurrence) => void;
} {
  let recurrence: Recurrence = { ...DEFAULT_RECURRENCE, ...initial, days: [...initial.days] };

  const kindGroup = optionButtons(KIND_OPTIONS, [recurrence.kind], false, (values) => {
    recurrence.kind = (values[0] as RecurrenceKind) ?? "daily";
    if (values.length === 0) kindGroup.setValues([recurrence.kind]);
    renderDetail();
  });

  const dayGroup = optionButtons(
    WEEKDAYS.map((value) => ({ value, label: WEEKDAY_LABELS[value] })),
    recurrence.days,
    true,
    (values) => {
      recurrence.days = values as Weekday[];
    },
  );

  const countInput = h("input", {
    type: "number",
    min: "1",
    max: "7",
    step: "1",
    value: String(recurrence.count),
  });
  countInput.addEventListener("input", () => {
    recurrence.count = Math.min(7, Math.max(1, Math.floor(Number(countInput.value) || 1)));
  });

  const intervalInput = h("input", {
    type: "number",
    min: "1",
    max: "365",
    step: "1",
    value: String(recurrence.intervalDays),
  });
  intervalInput.addEventListener("input", () => {
    recurrence.intervalDays = Math.max(1, Math.floor(Number(intervalInput.value) || 1));
  });

  const detail = h("div", { class: "stack", style: { gap: "0.4rem" } });

  function renderDetail(): void {
    if (recurrence.kind === "weekdays") {
      detail.replaceChildren(dayGroup.root);
    } else if (recurrence.kind === "per_week") {
      detail.replaceChildren(
        h(
          "div",
          { class: "row", style: { gap: "0.5rem", alignItems: "center" } },
          countInput,
          h("span", { class: "dim small" }, "doses a week — log them on any days"),
        ),
      );
    } else if (recurrence.kind === "interval") {
      detail.replaceChildren(
        h(
          "div",
          { class: "row", style: { gap: "0.5rem", alignItems: "center" } },
          intervalInput,
          h("span", { class: "dim small" }, "days apart"),
        ),
      );
    } else {
      detail.replaceChildren();
    }
  }
  renderDetail();

  function setValue(next: Recurrence): void {
    recurrence = { ...DEFAULT_RECURRENCE, ...next, days: [...next.days] };
    kindGroup.setValues([recurrence.kind]);
    dayGroup.setValues(recurrence.days);
    countInput.value = String(recurrence.count);
    intervalInput.value = String(recurrence.intervalDays);
    renderDetail();
  }

  return {
    root: h("div", { class: "stack", style: { gap: "0.5rem" } }, kindGroup.root, detail),
    setValue,
    value: () => ({
      kind: recurrence.kind,
      days: recurrence.kind === "weekdays" ? [...recurrence.days] : [],
      count: recurrence.kind === "per_week" ? recurrence.count : 1,
      intervalDays: recurrence.kind === "interval" ? recurrence.intervalDays : 1,
    }),
  };
}
