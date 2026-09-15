import type { DaySlot } from "../../../shared/slots.ts";
import { DAY_SLOT_LABELS, slotStatus, slotTimeStatus } from "../../../shared/slots.ts";
import { h } from "../dom.ts";

export function slotTimeBadge(slot: string | null, at: string | Date): HTMLElement | null {
  if (!slot) return null;
  const status = slotTimeStatus(slot as DaySlot, new Date(at));
  if (status === "on_time") return null;
  return h(
    "span",
    { class: status === "late" ? "badge watch" : "badge" },
    status === "late" ? "Late" : "Early",
  );
}

export function slotChips(options: {
  slots: DaySlot[];
  logs: { slot: string | null; at?: string | Date }[];
  canRecord: boolean;
  onLog: (slot: DaySlot) => void;
}): HTMLElement | null {
  if (options.slots.length === 0) return null;
  const statuses = slotStatus(options.slots, options.logs);
  const extras = [
    ...new Set(
      options.logs
        .map((log) => log.slot)
        .filter(
          (slot): slot is DaySlot => slot !== null && !options.slots.includes(slot as DaySlot),
        ),
    ),
  ];
  const chips = [...statuses, ...extras.map((slot) => ({ slot, done: true, status: null }))];
  return h(
    "div",
    { class: "row wrap", style: { gap: "0.3rem" } },
    chips.map((entry) => {
      const late = entry.status === "late";
      const label = `${DAY_SLOT_LABELS[entry.slot]}${entry.done ? (late ? " !" : " ✓") : ""}`;
      const classes = `slot-chip${entry.done ? " done" : ""}${late ? " late" : ""}`;
      return options.canRecord
        ? h(
            "button",
            { class: classes, type: "button", onClick: () => options.onLog(entry.slot) },
            label,
          )
        : h("span", { class: classes }, label);
    }),
  );
}
