import type { DrugDto, RabbitDto, TreatmentDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openMedicationLogModal(options: {
  rabbit: RabbitDto;
  treatments: TreatmentDto[];
  drugs: DrugDto[];
  treatmentId?: number;
  onSaved: () => void;
}): void {
  const active = options.treatments.filter((treatment) => treatment.status === "active");
  const treatmentSelect = h(
    "select",
    null,
    h("option", { value: "" }, "— Not linked to a treatment —"),
    active.map((treatment) =>
      h(
        "option",
        { value: String(treatment.id) },
        treatment.dose ? `${treatment.medication} · ${treatment.dose}` : treatment.medication,
      ),
    ),
  );
  treatmentSelect.value = String(options.treatmentId ?? active[0]?.id ?? "");

  const drugSelect = h(
    "select",
    null,
    h("option", { value: "" }, "— No drug —"),
    options.drugs.map((drug) => h("option", { value: String(drug.id) }, drug.name)),
  );
  const amount = h("input", { inputmode: "decimal", placeholder: "e.g. 0.3" });
  const amountHint = h("span", { class: "dim small" });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(new Date());
  const notes = h("textarea", null, "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Log dose");

  const selectedTreatment = (): TreatmentDto | undefined =>
    active.find((treatment) => String(treatment.id) === treatmentSelect.value);
  const selectedDrug = (): DrugDto | undefined =>
    options.drugs.find((drug) => String(drug.id) === drugSelect.value);

  const syncFromTreatment = () => {
    const treatment = selectedTreatment();
    if (treatment?.drugId != null) drugSelect.value = String(treatment.drugId);
    if (treatment?.doseMilliUnits != null) {
      amount.value = String(Number((treatment.doseMilliUnits / 1000).toFixed(3)));
    }
    syncHint();
  };

  const syncHint = () => {
    const drug = selectedDrug();
    const text = amount.value.trim();
    if (drug && text) {
      amountHint.textContent = `Deducts ${text} ${drug.unit} from ${drug.name} stock (earliest expiry first).`;
    } else {
      amountHint.textContent = "Amount is optional; leave blank to just note the dose.";
    }
  };

  treatmentSelect.addEventListener("change", syncFromTreatment);
  drugSelect.addEventListener("change", syncHint);
  amount.addEventListener("input", syncHint);
  syncFromTreatment();

  const modal = openModal({
    title: `Log medication — ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const givenAt = new Date(when.value);
          if (Number.isNaN(givenAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          const amountText = amount.value.trim();
          const amountMilliUnits = amountText ? Math.round(Number(amountText) * 1000) : null;
          if (amountText && (amountMilliUnits === null || !Number.isFinite(amountMilliUnits) || amountMilliUnits < 0)) {
            error.textContent = "Enter a valid amount.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            await api.post("/api/medication-logs", {
              rabbitId: options.rabbit.id,
              treatmentId: treatmentSelect.value ? Number(treatmentSelect.value) : null,
              drugId: drugSelect.value ? Number(drugSelect.value) : null,
              givenAt: givenAt.toISOString(),
              amountMilliUnits,
              notes: notes.value.trim(),
            });
            toast("Dose logged");
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
      h("div", { class: "field" }, h("label", null, "Treatment"), treatmentSelect),
      h("div", { class: "field" }, h("label", null, "Drug"), drugSelect),
      h(
        "div",
        { class: "field" },
        h("label", null, "Amount given"),
        amount,
        amountHint,
      ),
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

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
