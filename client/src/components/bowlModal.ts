import type { BowlDto, RabbitDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
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

  const modal = openModal({
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
              await api.patch(`/api/bowls/${editing.id}`, { label: name });
            } else {
              await api.post("/api/bowls", {
                rabbitId: options.rabbit.id,
                label: name,
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
  onSaved: () => void;
}): void {
  const { bowl, mode } = options;
  const current = bowl.currentWeightGrams;
  let topUpTotal = false;
  const amount = h("input", {
    inputmode: "decimal",
    required: true,
    placeholder: mode === "refill" ? "e.g. 250" : "e.g. 850",
  });
  const finalWeight = h("input", {
    inputmode: "decimal",
    placeholder: current != null ? String(current) : "e.g. 600",
  });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(new Date());
  const notes = h("textarea");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  const title =
    mode === "weigh" ? "Weigh bowl" : mode === "refill" ? "Top up bowl" : "Refresh bowl";
  const amountLabel = h("label");
  const hint = h("span", { class: "dim small" });
  const save = h("button", { class: "btn primary", type: "submit" });

  const topUpOptions =
    mode === "refill"
      ? optionButtons(
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
        )
      : null;

  function renderLabels(): void {
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
  renderLabels();

  const modal = openModal({
    title: `${title} — ${bowl.label}`,
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
      topUpOptions
        ? h("div", { class: "field" }, h("label", null, "Record as"), topUpOptions.root)
        : null,
      h("div", { class: "field" }, amountLabel, amount, hint),
      mode === "refresh"
        ? h(
            "div",
            { class: "field" },
            h("label", null, "Final weight (optional)"),
            finalWeight,
            h("span", { class: "dim small" }, "The last weight before the reset, so the final consumption is counted."),
          )
        : null,
      h("div", { class: "field" }, h("label", null, "When"), when),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
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

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
