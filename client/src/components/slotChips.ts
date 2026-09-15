import type { DaySlot } from "../../../shared/slots.ts";
import { DAY_SLOT_LABELS, slotStatus } from "../../../shared/slots.ts";
import { h } from "../dom.ts";

export function slotChips(options: {
  slots: DaySlot[];
  logs: { slot: string | null }[];
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
  const chips = [...statuses, ...extras.map((slot) => ({ slot, done: true }))];
  return h(
    "div",
    { class: "row wrap", style: { gap: "0.3rem" } },
    chips.map((entry) => {
      const label = `${DAY_SLOT_LABELS[entry.slot]}${entry.done ? " ✓" : ""}`;
      return options.canRecord
        ? h(
            "button",
            {
              class: `slot-chip${entry.done ? " done" : ""}`,
              type: "button",
              onClick: () => options.onLog(entry.slot),
            },
            label,
          )
        : h("span", { class: `slot-chip${entry.done ? " done" : ""}` }, label);
    }),
  );
}
