import type { BowlDto, BowlReadingDto, FoodProductDto, RabbitDto } from "../../../shared/types.ts";
import { bowlReadingKindLabel } from "../../../shared/bowls.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import {
  DAY_SLOT_LABELS,
  DAY_SLOTS,
  nextPendingSlot,
  slotForTime,
  slotRangeLabel,
  slotTimeStatus,
} from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { fmtTime, h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { slotTimeBadge } from "./slotChips.ts";
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
  const tare = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 120",
    value: editing?.tareGrams != null ? String(editing.tareGrams) : "",
  });
  const productSelect = h("select", null, h("option", { value: "" }, "— No linked product —"));
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(new Date());
  const notes = h("textarea");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save" : "Add bowl");

  void api
    .get<{ products: { id: number; name: string }[] }>("/api/food-products")
    .then(({ products }) => {
      for (const product of products) {
        productSelect.append(h("option", { value: String(product.id) }, product.name));
      }
      productSelect.value = editing?.productId != null ? String(editing.productId) : "";
    })
    .catch(() => {
      productSelect.disabled = true;
    });

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
          const tareGrams = tare.value.trim() ? parseGrams(tare.value) : null;
          if (tare.value.trim() && (tareGrams === null || tareGrams < 0)) {
            error.textContent = "Enter the bowl's empty weight in grams.";
            error.style.display = "";
            return;
          }
          const productId = productSelect.value ? Number(productSelect.value) : null;
          save.disabled = true;
          try {
            if (editing) {
              await api.patch(`/api/bowls/${editing.id}`, { label: name, slots, tareGrams, productId });
            } else {
              await api.post("/api/bowls", {
                rabbitId: options.rabbit.id,
                label: name,
                slots,
                tareGrams,
                productId,
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
      h(
        "div",
        { class: "field" },
        h("label", null, "Bowl weight (empty, optional)"),
        tare,
        h(
          "span",
          { class: "dim small" },
          "Weigh the empty bowl so the app can show how much food or water is in it.",
        ),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Linked food product (optional)"),
        productSelect,
        h("span", { class: "dim small" }, "Topping up this bowl draws the amount from the product's stock."),
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
  editing?: BowlReadingDto;
  product?: FoodProductDto;
  onSaved: () => void;
}): void {
  const { bowl, product } = options;
  const editing = options.editing;
  const scheduled = !editing && (options.date !== undefined || options.slot !== undefined);
  const current = bowl.currentWeightGrams;
  let mode: BowlReadingMode = editing ? readingMode(editing.kind) : options.mode;
  let topUpTotal = false;
  let slot: DaySlot | null = editing?.slot ?? options.slot ?? null;
  let slotTouched = editing !== undefined || options.slot !== undefined;

  const amount = h("input", {
    inputmode: "decimal",
    required: true,
    placeholder: "e.g. 850",
  });
  if (editing) amount.value = String(mode === "refill" ? editing.refillGrams : editing.weightGrams);
  const finalWeight = h("input", {
    inputmode: "decimal",
    placeholder: current != null ? String(current) : "e.g. 600",
  });
  const preWeight = h("input", {
    inputmode: "decimal",
    placeholder: current != null ? String(current) : "e.g. 600",
  });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(editing ? new Date(editing.readAt) : initialWhen(options.date));
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  const amountLabel = h("label");
  const hint = h("span", { class: "dim small" });
  const productHint = h("span", { class: "dim small" });
  productHint.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" });

  const updateProductHint = (): void => {
    const grams = parseGrams(amount.value);
    const show = product !== undefined && mode === "refill" && !topUpTotal && grams !== null && grams > 0;
    productHint.style.display = show ? "" : "none";
    if (show && product) {
      productHint.textContent = `Deducts ${formatFoodAmount(grams)} from ${product.name} stock.`;
    }
  };
  amount.addEventListener("input", updateProductHint);
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
  const preWeightField = h(
    "div",
    { class: "field" },
    h("label", null, "Weight before top-up (optional)"),
    preWeight,
    h(
      "span",
      { class: "dim small" },
      "Weigh the bowl before topping up and enter it here, so the consumption is counted too.",
    ),
  );
  preWeightField.style.display = "none";

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
    topUpField.style.display = mode === "refill" && !editing ? "" : "none";
    finalField.style.display = mode === "refresh" && !editing ? "" : "none";
    preWeightField.style.display =
      mode === "refill" && !editing && !topUpTotal ? "" : "none";
    updateProductHint();
    if (editing) {
      save.textContent = "Save reading";
      amountLabel.textContent = mode === "refill" ? "Amount added (g)" : "Weight (g)";
      hint.textContent = "Edit this reading; consumption totals are recalculated.";
      return;
    }
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
    const available = [...bowl.slots];
    if (slot !== null && !available.includes(slot)) available.push(slot);
    const pending = nextPendingSlot(available, dayReadings());
    const reference = when.value ? new Date(when.value) : new Date();
    const timeSlot = slotForTime(reference);
    const keep =
      slotTouched && slot !== null && available.includes(slot)
        ? slot
        : available.includes(timeSlot)
          ? timeSlot
          : (pending ?? available[0]);
    slot = keep;
    const group = optionButtons(
      available.map((value) => ({ value, label: DAY_SLOT_LABELS[value] })),
      [keep],
      false,
      (values) => {
        slotTouched = true;
        slot = (values[0] as DaySlot | undefined) ?? null;
      },
    );
    const status = slotTimeStatus(keep, reference);
    slotField.replaceChildren(
      h("label", null, "Time of day"),
      group.root,
      h(
        "span",
        {
          class: status === "on_time" ? "dim small" : "small",
          style: status === "late" ? { color: "var(--warn)" } : undefined,
        },
        `${DAY_SLOT_LABELS[keep]} is ${slotRangeLabel(keep)}${
          status === "late" ? " — this time is late" : status === "early" ? " — this time is early" : ""
        }`,
      ),
    );
  }

  function renderDayList(): void {
    const readings = dayReadings().filter((reading) => reading.id !== editing?.id);
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
              "div",
              { class: "row wrap", style: { gap: "0.35rem" } },
              h(
                "span",
                null,
                bowlReadingKindLabel(reading.kind),
                reading.slot
                  ? h("span", { class: "dim small" }, ` · ${DAY_SLOT_LABELS[reading.slot]}`)
                  : null,
              ),
              slotTimeBadge(reading.slot, reading.readAt),
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
            { class: "btn ghost small", type: "button", onClick: () => void editReading(reading) },
            "Edit",
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

  function editReading(reading: BowlReadingDto): void {
    modal.close();
    openBowlReadingModal({
      bowl,
      mode: readingMode(reading.kind),
      editing: reading,
      onSaved: options.onSaved,
    });
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
    title: editing
      ? `Edit ${bowlReadingKindLabel(editing.kind)} — ${bowl.label}`
      : scheduled
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
          const preGrams =
            mode === "refill" && !asNewTotal && preWeight.value.trim()
              ? parseGrams(preWeight.value)
              : null;
          if (
            mode === "refill" &&
            !asNewTotal &&
            preWeight.value.trim() &&
            (preGrams === null || preGrams < 0)
          ) {
            error.textContent = "Enter the weight before topping up in grams.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            if (editing) {
              await api.patch(`/api/bowls/${bowl.id}/readings/${editing.id}`, {
                readAt: readAt.toISOString(),
                slot,
                weightGrams: mode === "refill" ? undefined : amountGrams,
                refillGrams: mode === "refill" ? amountGrams : undefined,
                notes: notes.value.trim(),
              });
            } else {
              await api.post(`/api/bowls/${bowl.id}/readings`, {
                kind: asNewTotal ? "weigh" : mode,
                readAt: readAt.toISOString(),
                slot,
                weightGrams: mode === "weigh" || asNewTotal ? amountGrams : undefined,
                refillGrams: mode === "refill" && !asNewTotal ? amountGrams : undefined,
                preWeightGrams: preGrams ?? undefined,
                finalWeightGrams: finalGrams ?? undefined,
                notes: notes.value.trim(),
              });
            }
            toast(
              editing
                ? "Reading updated"
                : mode === "weigh" || asNewTotal
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
      h("div", { class: "field" }, amountLabel, amount, hint, productHint),
      preWeightField,
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

function readingMode(kind: BowlReadingDto["kind"]): BowlReadingMode {
  return kind === "refill" || kind === "refresh" ? kind : "weigh";
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
