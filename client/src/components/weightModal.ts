import type { HealthCheckDto, RabbitDto } from "../../../shared/types.ts";
import { parseWeightInput, weightInputValue } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lastLoggedLine } from "./lastLogged.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openWeightModal(options: {
  rabbit: RabbitDto;
  previousWeightGrams?: number | null;
  previousWeightAt?: string | null;
  onSaved: (check: HealthCheckDto) => void;
}): void {
  const weight = h("input", {
    name: "weight",
    inputmode: "decimal",
    placeholder: "e.g. 2.35",
    required: true,
  });
  const when = h("input", { type: "datetime-local", name: "checkedAt" });
  when.value = toLocalInputValue(new Date());
  const previous = options.previousWeightGrams;
  const hint =
    previous != null
      ? `Previous weight: ${(previous / 1000).toFixed(2)} kg. Adjust it to today's weight.`
      : "Kilograms by default — 2350g also works.";
  if (previous != null) weight.value = weightInputValue(previous);

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Save weight");

  const modal = openModal({
    guardUnsaved: true,
    title: `Weigh ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const weightText = weight.value.trim();
          const weightGrams = weightText ? parseWeightInput(weightText) : null;
          if (weightGrams === null) {
            error.textContent = "Enter weight as kilograms (2.35) or grams (2350g).";
            error.style.display = "";
            return;
          }
          const checkedAt = new Date(when.value);
          if (Number.isNaN(checkedAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            const result = await api.post<{ check: HealthCheckDto }>("/api/checks", {
              rabbitId: options.rabbit.id,
              checkedAt: checkedAt.toISOString(),
              weightGrams,
            });
            options.onSaved(result.check);
            toast("Weight logged");
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
      h(
        "div",
        { class: "field" },
        h("label", null, "Weight"),
        weight,
        h("span", { class: "dim small" }, hint),
      ),
      lastLoggedLine("Last weight", options.previousWeightAt),
      h("div", { class: "field" }, h("label", null, "When"), when),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
