import type { BowlDto, BowlReadingDto, RabbitDto } from "../../../shared/types.ts";
import { bowlReadingKindLabel } from "../../../shared/bowls.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import { DAY_SLOT_LABELS, DAY_SLOTS, nextPendingSlot } from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { fmtTime, h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { optionButtons } from "./toggle.ts";

export type BowlReadingMode = "weigh" | "refill" | "refresh";

export function openBowlModal(options: {
  rabbit: RabbitDto;
  bowl?: BowlDto;
  onSaved: () => void;
}): void {
  const editing = options.bowl;
  const label = h("input", { required: true, value: editing?.label ?? "", placeholder: "e.g. Water bowl" });
  const weight = h("input", { inputmode: "decimal", placeholder: "e.g. 850" });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(new Date());
  const notes = h("textarea");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save" : "Add bowl");

  let slots: DaySlot[] = [...(editing?.slots ?? [])];
  const slotGroup = optionButtons(
    DAY_SLOTS.map((value) => ({ value, label: DAY_SLOT_LABELS[value] })),
    slots,
    true,
    (values) => {
      slots = values as DaySlot[];
    },
  );

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.label}` : `Add bowl — ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const name = label.value.trim();
          if (!name) {
            error.textContent = "Give the bowl a name.";
            error.style.display = "";
            return;
          }
          let startWeightGrams: number | null = null;
          if (!editing) {
            startWeightGrams = parseGrams(weight.value);
            if (startWeightGrams === null || startWeightGrams <= 0) {
              error.textContent = "Enter the starting weight in grams.";
              error.style.display = "";
              return;
            }
          }
          const startedAt = new Date(when.value);
          if (!editing && Number.isNaN(startedAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            if (editing) {
              await api.patch(`/api/bowls/${editing.id}`, { label: name, slots });
            } else {
              await api.post("/api/bowls", {
                rabbitId: options.rabbit.id,
                label: name,
                slots,
                startWeightGrams,
                startedAt: startedAt.toISOString(),
                notes: notes.value.trim(),
              });
            }
            toast(editing ? "Bowl updated" : "Bowl added");
            options.onSaved();
            modal.close();
          } catch (err) {
            error.textContent = err instanceof Error ? err.message : "Something went wrong";
            error.style.display = "";
          } finally {
            save.disabled = false;
          }
        },
      },
      error,
      h("div", { class: "field" }, h("label", null, "Name"), label),
      h(
        "div",
        { class: "field" },
        h("label", null, "Times of day"),
        slotGroup.root,
        h(
          "span",
          { class: "dim small" },
          "Tick each time this bowl is checked, topped up or weighed. Leave empty to keep it unscheduled.",
        ),
      ),
      editing
        ? null
        : h(
            "div",
            { class: "field" },
            h("label", null, "Starting weight (g)"),
            weight,
            h("span", { class: "dim small" }, "Weigh the full bowl and enter the number."),
          ),
      editing ? null : h("div", { class: "field" }, h("label", null, "When"), when),
      editing ? null : h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

export function openBowlReadingModal(options: {
  bowl: BowlDto;
  mode: BowlReadingMode;
  date?: Date;
  slot?: DaySlot;
  onSaved: () => void;
}): void {
  const { bowl } = options;
  const scheduled = options.date !== undefined || options.slot !== undefined;
  const current = bowl.currentWeightGrams;
  let mode: BowlReadingMode = options.mode;
  let topUpTotal = false;
  let slot: DaySlot | null = options.slot ?? null;

  const amount = h("input", {
    inputmode: "decimal",
    required: true,
    placeholder: "e.g. 850",
  });
  const finalWeight = h("input", {
    inputmode: "decimal",
    placeholder: current != null ? String(current) : "e.g. 600",
  });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(initialWhen(options.date));
  const notes = h("textarea");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  const amountLabel = h("label");
  const hint = h("span", { class: "dim small" });
  const save = h("button", { class: "btn primary", type: "submit" });
  const finalField = h(
    "div",
    { class: "field" },
    h("label", null, "Final weight (optional)"),
    finalWeight,
    h(
      "span",
      { class: "dim small" },
      "The last weight before the reset, so the final consumption is counted.",
    ),
  );

  const topUpOptions = optionButtons(
    [
      { value: "add", label: "I added this much" },
      { value: "total", label: "This is the new total" },
    ],
    ["add"],
    false,
    (values) => {
      topUpTotal = values[0] === "total";
      renderLabels();
    },
  );
  const topUpField = h("div", { class: "field" }, h("label", null, "Record as"), topUpOptions.root);

  const modeOptions = scheduled
    ? optionButtons(
        [
          { value: "weigh", label: "Weigh" },
          { value: "refill", label: "Top up" },
          { value: "refresh", label: "Refresh" },
        ],
        [mode],
        false,
        (values) => {
          mode = (values[0] as BowlReadingMode | undefined) ?? "weigh";
          renderLabels();
        },
      )
    : null;
  const modeField = modeOptions
    ? h("div", { class: "field" }, h("label", null, "Action"), modeOptions.root)
    : null;

  const slotField = h("div", { class: "field" });
  const dayList = h("div", { class: "stack", style: { gap: "0" } });
  const dayListLabel = h("p", { class: "task-slot dim small" });

  const dayReadings = (): BowlReadingDto[] => {
    const day = localDayKey(new Date(when.value));
    return bowl.readings
      .filter((reading) => localDayKey(new Date(reading.readAt)) === day)
      .sort((a, b) => a.readAt.localeCompare(b.readAt));
  };

  function renderLabels(): void {
    modeOptions?.setValues([mode]);
    topUpField.style.display = mode === "refill" ? "" : "none";
    finalField.style.display = mode === "refresh" ? "" : "none";
    if (mode === "weigh") {
      amountLabel.textContent = "Weight (g)";
      hint.textContent = current != null ? `Current weight ${current} g.` : "Weigh the bowl and enter the number.";
      save.textContent = "Log weight";
      return;
    }
    if (mode === "refresh") {
      amountLabel.textContent = "New starting weight (g)";
      hint.textContent =
        current != null
          ? `Current weight ${current} g. Optionally record it as the final weight, then enter the new starting weight.`
          : "Weigh the bowl and enter the number.";
      save.textContent = "Refresh";
      return;
    }
    amountLabel.textContent = topUpTotal ? "New total weight (g)" : "Amount added (g)";
    amount.placeholder = topUpTotal
      ? current != null
        ? String(current)
        : "e.g. 850"
      : "e.g. 250";
    hint.textContent = topUpTotal
      ? current != null
        ? `Current weight ${current} g — enter the weight after topping up.`
        : "Weigh the bowl after topping up and enter the number."
      : current != null
        ? `Current weight ${current} g — enter how much you added.`
        : "Enter how much you added.";
    save.textContent = topUpTotal ? "Log weight" : "Log top-up";
  }

  function renderSlotPicker(): void {
    if (bowl.slots.length === 0) {
      slot = null;
      slotField.style.display = "none";
      return;
    }
    slotField.style.display = "";
    const pending = nextPendingSlot(bowl.slots, dayReadings());
    const keep = slot !== null && bowl.slots.includes(slot) ? slot : (pending ?? bowl.slots[0]);
    slot = keep;
    const group = optionButtons(
      bowl.slots.map((value) => ({ value, label: DAY_SLOT_LABELS[value] })),
      [keep],
      false,
      (values) => {
        slot = (values[0] as DaySlot | undefined) ?? null;
      },
    );
    slotField.replaceChildren(h("label", null, "Time of day"), group.root);
  }

  function renderDayList(): void {
    const readings = dayReadings();
    dayListLabel.textContent = `Logged on ${dayLabel(when.value)}`;
    dayListLabel.style.display = readings.length > 0 ? "" : "none";
    dayList.replaceChildren(
      ...readings.map((reading) =>
        h(
          "div",
          { class: "list-row" },
          h(
            "div",
            { class: "stack", style: { gap: "0.15rem" } },
            h(
              "span",
              null,
              bowlReadingKindLabel(reading.kind),
              reading.slot ? h("span", { class: "dim small" }, ` · ${DAY_SLOT_LABELS[reading.slot]}`) : null,
            ),
            reading.notes ? h("span", { class: "dim small" }, reading.notes) : null,
          ),
          h("span", { class: "spacer" }),
          h(
            "span",
            { class: "dim small" },
            `${fmtTime(reading.readAt)} · ${reading.weightGrams} g`,
          ),
          h(
            "button",
            { class: "btn ghost small", type: "button", onClick: () => void removeReading(reading) },
            "Delete",
          ),
        ),
      ),
    );
  }

  async function removeReading(reading: BowlReadingDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Delete reading?",
      message: "Consumption totals are recalculated from the remaining readings.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/bowls/${bowl.id}/readings/${reading.id}`);
      toast("Reading deleted");
      options.onSaved();
      modal.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the reading", "error");
    }
  }

  renderLabels();
  renderSlotPicker();
  renderDayList();
  when.addEventListener("change", () => {
    renderSlotPicker();
    renderDayList();
  });

  const modal = openModal({
    guardUnsaved: true,
    title: scheduled
      ? `Log reading — ${bowl.label}`
      : mode === "weigh"
        ? `Weigh bowl — ${bowl.label}`
        : mode === "refill"
          ? `Top up bowl — ${bowl.label}`
          : `Refresh bowl — ${bowl.label}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const readAt = new Date(when.value);
          if (Number.isNaN(readAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          const amountGrams = parseGrams(amount.value);
          if (amountGrams === null || amountGrams < 0) {
            error.textContent = "Enter a number in grams.";
            error.style.display = "";
            return;
          }
          if (mode === "refill" && !topUpTotal && amountGrams <= 0) {
            error.textContent = "Enter how much you added.";
            error.style.display = "";
            return;
          }
          const finalGrams = mode === "refresh" && finalWeight.value.trim() ? parseGrams(finalWeight.value) : null;
          if (mode === "refresh" && finalWeight.value.trim() && (finalGrams === null || finalGrams < 0)) {
            error.textContent = "Enter the final weight in grams.";
            error.style.display = "";
            return;
          }
          const asNewTotal = mode === "refill" && topUpTotal;
          save.disabled = true;
          try {
            await api.post(`/api/bowls/${bowl.id}/readings`, {
              kind: asNewTotal ? "weigh" : mode,
              readAt: readAt.toISOString(),
              slot,
              weightGrams: mode === "weigh" || asNewTotal ? amountGrams : undefined,
              refillGrams: mode === "refill" && !asNewTotal ? amountGrams : undefined,
              finalWeightGrams: finalGrams ?? undefined,
              notes: notes.value.trim(),
            });
            toast(
              mode === "weigh" || asNewTotal
                ? "Weight logged"
                : mode === "refill"
                  ? "Top-up logged"
                  : "Bowl refreshed",
            );
            options.onSaved();
            modal.close();
          } catch (err) {
            error.textContent = err instanceof Error ? err.message : "Something went wrong";
            error.style.display = "";
          } finally {
            save.disabled = false;
          }
        },
      },
      error,
      modeField,
      slotField,
      topUpField,
      h("div", { class: "field" }, amountLabel, amount, hint),
      finalField,
      h("div", { class: "field" }, h("label", null, "When"), when),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      dayListLabel,
      dayList,
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

function parseGrams(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const grams = Number(text);
  return Number.isFinite(grams) ? Math.round(grams) : null;
}

function initialWhen(date: Date | undefined): Date {
  const now = new Date();
  const base = date ? new Date(date) : now;
  if (localDayKey(base) === localDayKey(now)) return now;
  base.setHours(12, 0, 0, 0);
  return base;
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
