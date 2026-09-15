import type { BowlDto, BowlReadingDto, FoodProductDto, RabbitDto } from "../../../shared/types.ts";
import { bowlReadingKindLabel, projectBowlWeight } from "../../../shared/bowls.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import {
  DAY_SLOT_LABELS,
  DAY_SLOTS,
  nearestSlot,
  nextPendingSlot,
  slotRangeLabel,
  slotTimeStatus,
} from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { fmtTime, h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { slotTimeBadge } from "./slotChips.ts";
import { toast } from "./toast.ts";
import { optionButtons } from "./toggle.ts";

export type BowlReadingMode = "weigh" | "consume" | "refill" | "refresh";

type SessionReading = {
  kind: BowlReadingMode;
  slot: DaySlot | null;
  weightGrams?: number;
  consumedGrams?: number;
  refillGrams?: number;
  finalWeightGrams?: number;
  notes: string;
};

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
  let kind: "food" | "water" = editing?.kind === "water" ? "water" : "food";
  const kindGroup = optionButtons(
    [
      { value: "food", label: "Food" },
      { value: "water", label: "Water" },
    ],
    [kind],
    false,
    (values) => {
      kind = values[0] === "water" ? "water" : "food";
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
              await api.patch(`/api/bowls/${editing.id}`, { label: name, kind, slots, tareGrams, productId });
            } else {
              await api.post("/api/bowls", {
                rabbitId: options.rabbit.id,
                label: name,
                kind,
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
        h("label", null, "Bowl type"),
        kindGroup.root,
        h("span", { class: "dim small" }, "Used to compare daily intake with the food and water norms."),
      ),
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
  date?: Date;
  slot?: DaySlot;
  editing?: BowlReadingDto;
  product?: FoodProductDto;
  onSaved: () => void;
}): void {
  const { bowl, product } = options;
  const editing = options.editing;
  const current = bowl.currentWeightGrams;
  const session = editing === undefined;

  let mode: BowlReadingMode = editing ? readingMode(editing.kind) : "weigh";
  let slot: DaySlot | null = editing?.slot ?? options.slot ?? null;
  let slotTouched = editing !== undefined || options.slot !== undefined;
  let overrideAll = false;
  const queue: SessionReading[] = [];

  const amount = h("input", { inputmode: "decimal", required: true, placeholder: "e.g. 850" });
  if (editing) amount.value = String(mode === "refill" ? editing.refillGrams : editing.weightGrams);
  const finalWeight = h("input", {
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
  const breakdown = h("div", { class: "calc-box" });
  breakdown.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" });
  const addAnother = session
    ? h("button", { class: "btn outline", type: "button", onClick: addToQueue }, "Add to session")
    : null;

  const baseline = (): number | null => projectBowlWeight(current, queue);

  const contents = (grams: number | null): string =>
    grams != null && bowl.tareGrams != null ? ` (${formatFoodAmount(grams - bowl.tareGrams)} in bowl)` : "";

  const updateProductHint = (): void => {
    const grams = parseGrams(amount.value);
    const show = product !== undefined && mode === "refill" && grams !== null && grams > 0;
    productHint.style.display = show ? "" : "none";
    if (show && product) {
      productHint.textContent = `Deducts ${formatFoodAmount(grams)} from ${product.name} stock.`;
    }
  };

  const updateBreakdown = (): void => {
    if (editing) {
      breakdown.style.display = "none";
      return;
    }
    const grams = parseGrams(amount.value);
    if (grams === null || grams <= 0) {
      breakdown.style.display = "none";
      return;
    }
    const base = baseline();
    const lines: string[] = [];
    if (mode === "weigh") {
      if (base != null) {
        const delta = base - grams;
        lines.push(
          delta > 0
            ? `Consumed ${delta} g since the last reading`
            : delta < 0
              ? `Refill of ${-delta} g since the last reading`
              : "Same as the last reading",
        );
      }
      lines.push(`New total ${grams} g${contents(grams)}`);
    } else if (mode === "consume") {
      if (base != null) {
        lines.push(
          grams > base
            ? `More than the bowl holds (${base} g)`
            : `New total ${base - grams} g${contents(base - grams)}`,
        );
      }
    } else if (mode === "refresh") {
      const final = parseGrams(finalWeight.value);
      if (final != null && base != null) {
        const delta = base - final;
        lines.push(
          delta > 0 ? `Consumed ${delta} g up to the final weigh-in` : "Final weigh-in is above the last reading",
        );
      }
      lines.push(`New period starts at ${grams} g${contents(grams)}`);
    } else {
      lines.push(`Added ${grams} g`);
      if (base != null) lines.push(`New total ${base + grams} g${contents(base + grams)}`);
    }
    breakdown.replaceChildren(...lines.map((line) => h("div", { class: "small" }, line)));
    breakdown.style.display = "";
  };

  amount.addEventListener("input", () => {
    updateProductHint();
    updateBreakdown();
  });
  finalWeight.addEventListener("input", updateBreakdown);

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

  const modeOptions = session
    ? optionButtons(
        [
          { value: "weigh", label: "Weigh" },
          { value: "consume", label: "Consumption" },
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
  const queueHeader = h("p", { class: "task-slot dim small" });
  queueHeader.style.display = "none";
  const queueList = h("div", { class: "stack", style: { gap: "0" } });
  queueList.style.display = "none";
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
    finalField.style.display = mode === "refresh" && !editing ? "" : "none";
    updateProductHint();
    updateBreakdown();
    if (editing) {
      save.textContent = "Save reading";
      amountLabel.textContent = mode === "refill" ? "Amount added (g)" : "Weight (g)";
      hint.textContent = "Edit this reading; consumption totals are recalculated.";
      return;
    }
    save.textContent = queue.length > 0 ? "Save all" : "Save reading";
    const base = baseline();
    if (mode === "weigh") {
      amountLabel.textContent = "Weight (g)";
      amount.placeholder = "e.g. 850";
      hint.textContent =
        base != null ? `Current weight ${base} g${contents(base)}.` : "Weigh the bowl and enter the number.";
      return;
    }
    if (mode === "consume") {
      amountLabel.textContent = "Amount consumed (g)";
      amount.placeholder = "e.g. 150";
      hint.textContent =
        base != null
          ? `Current weight ${base} g${contents(base)} — enter how much was eaten; the new weight is calculated.`
          : "Add a starting weight first.";
      return;
    }
    if (mode === "refresh") {
      amountLabel.textContent = "New starting weight (g)";
      amount.placeholder = "e.g. 850";
      hint.textContent =
        base != null
          ? `Current weight ${base} g${contents(base)}. Optionally record it as the final weight, then enter the new starting weight.`
          : "Weigh the bowl and enter the number.";
      return;
    }
    amountLabel.textContent = "Amount added (g)";
    amount.placeholder = "e.g. 250";
    hint.textContent =
      base != null ? `Current weight ${base} g${contents(base)} — enter how much you added.` : "Enter how much you added.";
  }

  function renderSlotPicker(): void {
    if (!overrideAll && bowl.slots.length === 0) {
      slot = null;
      slotField.style.display = "none";
      return;
    }
    slotField.style.display = "";
    if (slot !== null && !bowl.slots.includes(slot)) overrideAll = true;
    const available = overrideAll ? [...DAY_SLOTS] : [...bowl.slots];
    if (slot !== null && !available.includes(slot)) available.push(slot);
    const queued = queue
      .filter((reading) => reading.slot !== null)
      .map((reading) => ({ slot: reading.slot as string }));
    const pending = nextPendingSlot(available, [...dayReadings(), ...queued]);
    const reference = when.value ? new Date(when.value) : new Date();
    const keep =
      slotTouched && slot !== null && available.includes(slot)
        ? slot
        : (nearestSlot(available, reference) ?? pending ?? available[0]);
    slot = keep;
    const group = optionButtons(
      available.map((value) => ({ value, label: DAY_SLOT_LABELS[value] })),
      [keep],
      false,
      (values) => {
        const next = values[0] as DaySlot | undefined;
        slotTouched = true;
        if (!next) {
          overrideAll = true;
          renderSlotPicker();
          return;
        }
        slot = next;
        renderSlotPicker();
      },
    );
    const status = slotTimeStatus(keep, reference);
    const children: Node[] = [
      h("label", null, overrideAll ? "Time of day (this reading only)" : "Time of day"),
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
    ];
    if (overrideAll) {
      children.push(
        h("span", { class: "dim small" }, "Showing every time of day — pick any for this reading."),
      );
    }
    slotField.replaceChildren(...children);
  }

  function renderQueue(): void {
    if (!session) return;
    queueHeader.textContent = `This session (${queue.length})`;
    queueHeader.style.display = queue.length > 0 ? "" : "none";
    queueList.style.display = queue.length > 0 ? "" : "none";
    queueList.replaceChildren(
      ...queue.map((reading, index) =>
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
                reading.slot ? h("span", { class: "dim small" }, ` · ${DAY_SLOT_LABELS[reading.slot]}`) : null,
              ),
            ),
            reading.notes ? h("span", { class: "dim small" }, reading.notes) : null,
          ),
          h("span", { class: "spacer" }),
          h("span", { class: "mono small" }, readingSummary(reading)),
          h(
            "button",
            {
              class: "btn ghost small",
              type: "button",
              onClick: () => {
                queue.splice(index, 1);
                renderLabels();
                renderQueue();
                renderDayList();
              },
            },
            "Remove",
          ),
        ),
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
            "div",
            { class: "stack", style: { gap: "0.1rem", alignItems: "flex-end", textAlign: "right" } },
            h("span", { class: "dim small" }, fmtTime(reading.readAt)),
            h(
              "span",
              { class: "mono small" },
              `${reading.weightGrams} g total`,
              reading.kind === "refill" && reading.refillGrams > 0
                ? h("span", { class: "dim" }, ` · topped up ${reading.refillGrams} g`)
                : reading.consumptionGrams > 0
                  ? h("span", { class: "dim" }, ` · consumed ${reading.consumptionGrams} g`)
                  : null,
            ),
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

  function collect(): SessionReading | null {
    error.style.display = "none";
    const amountGrams = parseGrams(amount.value);
    if (amountGrams === null || amountGrams < 0) {
      error.textContent = "Enter a number in grams.";
      error.style.display = "";
      return null;
    }
    if (mode === "refill" && amountGrams <= 0) {
      error.textContent = "Enter how much you added.";
      error.style.display = "";
      return null;
    }
    const finalGrams = mode === "refresh" && finalWeight.value.trim() ? parseGrams(finalWeight.value) : null;
    if (mode === "refresh" && finalWeight.value.trim() && (finalGrams === null || finalGrams < 0)) {
      error.textContent = "Enter the final weight in grams.";
      error.style.display = "";
      return null;
    }
    const base = baseline();
    if (mode === "consume" && base != null && amountGrams > base) {
      error.textContent = "That is more than the bowl holds.";
      error.style.display = "";
      return null;
    }
    const reading: SessionReading = { kind: mode, slot, notes: notes.value.trim() };
    if (mode === "weigh" || mode === "refresh") reading.weightGrams = amountGrams;
    else if (mode === "consume") reading.consumedGrams = amountGrams;
    else reading.refillGrams = amountGrams;
    if (mode === "refresh" && finalGrams !== null) reading.finalWeightGrams = finalGrams;
    return reading;
  }

  function addToQueue(): void {
    const reading = collect();
    if (!reading) return;
    queue.push(reading);
    amount.value = "";
    finalWeight.value = "";
    notes.value = "";
    renderLabels();
    renderQueue();
    renderDayList();
    amount.focus();
  }

  async function submit(): Promise<void> {
    error.style.display = "none";
    const readAt = new Date(when.value);
    if (Number.isNaN(readAt.getTime())) {
      error.textContent = "Pick a valid date and time.";
      error.style.display = "";
      return;
    }
    let readings: SessionReading[];
    if (editing) {
      const reading = collect();
      if (!reading) return;
      readings = [reading];
    } else {
      readings = [...queue];
      if (amount.value.trim()) {
        const reading = collect();
        if (!reading) return;
        readings.push(reading);
      }
      if (readings.length === 0) {
        error.textContent = "Add a reading to log.";
        error.style.display = "";
        return;
      }
    }
    save.disabled = true;
    if (addAnother) addAnother.disabled = true;
    try {
      if (editing) {
        const reading = readings[0];
        await api.patch(`/api/bowls/${bowl.id}/readings/${editing.id}`, {
          readAt: readAt.toISOString(),
          slot: reading.slot,
          weightGrams: reading.kind === "refill" ? undefined : reading.weightGrams,
          refillGrams: reading.kind === "refill" ? reading.refillGrams : undefined,
          notes: reading.notes,
        });
        toast("Reading updated");
      } else {
        await api.post(`/api/bowls/${bowl.id}/readings/batch`, {
          readings: readings.map((reading) => ({
            kind: reading.kind,
            readAt: readAt.toISOString(),
            slot: reading.slot,
            weightGrams: reading.weightGrams,
            consumedGrams: reading.consumedGrams,
            refillGrams: reading.refillGrams,
            finalWeightGrams: reading.finalWeightGrams,
            notes: reading.notes,
          })),
        });
        toast(
          readings.length > 1
            ? `${readings.length} readings logged`
            : readingToast(readings[0].kind),
        );
      }
      options.onSaved();
      modal.close();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    } finally {
      save.disabled = false;
      if (addAnother) addAnother.disabled = false;
    }
  }

  function editReading(reading: BowlReadingDto): void {
    modal.close();
    openBowlReadingModal({
      bowl,
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
  renderQueue();
  renderDayList();
  when.addEventListener("change", () => {
    renderSlotPicker();
    renderDayList();
  });

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${bowlReadingKindLabel(editing.kind)} — ${bowl.label}` : `Log reading — ${bowl.label}`,
    body: h(
      "form",
      {
        onSubmit: (event: Event) => {
          event.preventDefault();
          void submit();
        },
      },
      error,
      modeField,
      slotField,
      h("div", { class: "field" }, amountLabel, amount, hint, productHint),
      breakdown,
      finalField,
      h("div", { class: "field" }, h("label", null, "When"), when),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      queueHeader,
      queueList,
      dayListLabel,
      dayList,
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        addAnother,
        save,
      ),
    ),
  });
}

function readingMode(kind: BowlReadingDto["kind"]): BowlReadingMode {
  return kind === "refill" || kind === "refresh" ? kind : "weigh";
}

function readingSummary(reading: SessionReading): string {
  if (reading.kind === "consume") return `−${reading.consumedGrams} g`;
  if (reading.kind === "refill") return `+${reading.refillGrams} g`;
  return `${reading.weightGrams} g`;
}

function readingToast(kind: BowlReadingMode): string {
  if (kind === "refill") return "Top-up logged";
  if (kind === "consume") return "Consumption logged";
  if (kind === "refresh") return "Bowl refreshed";
  return "Weight logged";
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
