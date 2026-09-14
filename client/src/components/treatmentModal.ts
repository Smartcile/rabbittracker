import type { DrugDto, HealthCheckDto, RabbitDto, TreatmentDto } from "../../../shared/types.ts";
import {
  courseTotalMilliUnits,
  doseMilliUnitsForWeight,
  formatDrugAmount,
  formatMgFromMicrograms,
  stockTotalMilliUnits,
} from "../../../shared/drugs.ts";
import { parseWeightInput, weightInputValue } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openTreatmentModal(options: {
  rabbits: RabbitDto[];
  rabbitId?: number;
  treatment?: TreatmentDto;
  onSaved: (treatment: TreatmentDto) => void;
}): void {
  const editing = options.treatment;
  let drugs: DrugDto[] = [];
  let drugsLoaded = false;

  const rabbitSelect = h(
    "select",
    { name: "rabbitId" },
    options.rabbits.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)),
  );
  rabbitSelect.value = String(editing?.rabbitId ?? options.rabbitId ?? options.rabbits[0]?.id ?? "");
  rabbitSelect.disabled = Boolean(editing);

  const drugSelect = h("select", null, h("option", { value: "" }, "— No linked drug —"));
  const weight = h("input", { inputmode: "decimal", placeholder: "e.g. 2.1 kg" });
  const info = h("div", { class: "drug-info" });
  const summary = h("div", { class: "drug-summary" });
  info.style.display = "none";
  summary.style.display = "none";

  const medication = h("input", { name: "medication", required: true, value: editing?.medication ?? "" });
  const dose = h("input", { name: "dose", value: editing?.dose ?? "" });
  const route = lookupSelect("route", { initialLabel: editing?.route ?? "" });
  const frequency = lookupSelect("frequency", { initialLabel: editing?.frequency ?? "" });
  const reason = lookupSelect("reason", { initialLabel: editing?.reason ?? "" });
  const startDate = h("input", { type: "date", name: "startDate", required: true, value: editing?.startDate ?? "" });
  const endDate = h("input", { type: "date", name: "endDate", value: editing?.endDate ?? "" });
  const status = h(
    "select",
    { name: "status" },
    h("option", { value: "active" }, "Active"),
    h("option", { value: "completed" }, "Completed"),
    h("option", { value: "stopped" }, "Stopped"),
  );
  status.value = editing?.status ?? "active";
  const notes = h("textarea", { name: "notes" }, editing?.notes ?? "");

  const weightField = h("div", { class: "field" }, h("label", null, "Weight for dose (kg)"), weight);
  weightField.style.display = "none";

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save treatment" : "Add treatment");

  function selectedDrug(): DrugDto | null {
    const id = Number(drugSelect.value);
    if (!Number.isInteger(id) || id <= 0) return null;
    return drugs.find((drug) => drug.id === id) ?? null;
  }

  function perDoseMilliUnits(drug: DrugDto): number | null {
    const parsed = doseMilliUnitsForWeight(drug, parseWeightInput(weight.value));
    if (parsed !== null) return parsed;
    if (editing && editing.drugId === drug.id) return editing.doseMilliUnits;
    return null;
  }

  function updatePreview(): void {
    const drug = selectedDrug();
    const structured =
      drug !== null &&
      drug.doseMicrogramsPerKg !== null &&
      drug.concentrationMicrogramsPerUnit !== null;
    info.style.display = drug ? "" : "none";
    weightField.style.display = structured ? "" : "none";
    summary.style.display = structured ? "" : "none";
    info.replaceChildren();
    summary.replaceChildren();
    if (!drug) return;
    info.append(
      h(
        "div",
        null,
        h(
          "div",
          { class: "row wrap" },
          drug.doseMicrogramsPerKg !== null
            ? h("span", { class: "chip" }, `${formatMgFromMicrograms(drug.doseMicrogramsPerKg)} mg/kg typical`)
            : null,
          drug.concentrationMicrogramsPerUnit !== null
            ? h("span", { class: "chip" }, `${formatMgFromMicrograms(drug.concentrationMicrogramsPerUnit)} mg/${drug.unit}`)
            : null,
          h("span", { class: "chip" }, `${drug.dosesPerDay}× daily`),
        ),
        drug.howToUse
          ? h("p", { class: "dim small", style: { margin: "0.35rem 0 0" } }, drug.howToUse)
          : null,
        drug.warnings
          ? h("p", { class: "small", style: { margin: "0.35rem 0 0", color: "var(--warn)" } }, drug.warnings)
          : null,
      ),
    );
    if (!structured) return;
    const perDose = perDoseMilliUnits(drug);
    if (perDose === null || perDose <= 0) {
      summary.append(h("p", { class: "dim small", style: { margin: 0 } }, "Enter a weight to calculate the dose."));
      return;
    }
    const total = courseTotalMilliUnits(
      perDose,
      drug.dosesPerDay,
      startDate.value || todayInputValue(),
      endDate.value || null,
      drug.durationDays,
    );
    const stock = stockTotalMilliUnits(drug.batches);
    dose.value = formatDrugAmount(perDose, drug.unit);
    summary.append(
      h(
        "div",
        null,
        h(
          "p",
          { class: "small", style: { margin: 0 } },
          `Dose ${formatDrugAmount(perDose, drug.unit)} · course needs ${formatDrugAmount(total, drug.unit)} · in stock ${formatDrugAmount(stock, drug.unit)}`,
        ),
        total > stock
          ? h(
              "p",
              { class: "form-error", style: { margin: "0.3rem 0 0" } },
              `Short by ${formatDrugAmount(total - stock, drug.unit)} — restock or adjust the course.`,
            )
          : null,
      ),
    );
  }

  function applyDrugDefaults(): void {
    const drug = selectedDrug();
    if (!drug) return;
    medication.value = drug.name;
    if (drug.route) route.setLabel(drug.route);
    if (drug.frequency) frequency.setLabel(drug.frequency);
  }

  drugSelect.addEventListener("change", () => {
    applyDrugDefaults();
    updatePreview();
  });
  weight.addEventListener("input", updatePreview);
  startDate.addEventListener("change", updatePreview);
  endDate.addEventListener("change", updatePreview);

  async function loadDrugs(): Promise<void> {
    try {
      const { drugs: rows } = await api.get<{ drugs: DrugDto[] }>("/api/drugs");
      drugs = rows;
      drugsLoaded = true;
      for (const drug of rows) {
        drugSelect.append(h("option", { value: String(drug.id) }, drug.name));
      }
      if (editing?.drugId) drugSelect.value = String(editing.drugId);
      updatePreview();
    } catch {
      drugSelect.disabled = true;
    }
  }

  async function loadWeight(): Promise<void> {
    const rabbitId = Number(rabbitSelect.value);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) return;
    try {
      const { checks } = await api.get<{ checks: HealthCheckDto[] }>(
        `/api/checks?rabbitId=${rabbitId}`,
      );
      const latest = checks.find((check) => check.weightGrams !== null);
      if (latest?.weightGrams != null) weight.value = weightInputValue(latest.weightGrams);
    } catch {
      // Weight is optional; the dose can be typed in manually.
    }
    updatePreview();
  }

  rabbitSelect.addEventListener("change", () => void loadWeight());

  const modal = openModal({
    title: editing ? `Edit ${editing.medication}` : "Add treatment",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          const drug = selectedDrug();
          const keepLink = editing && !drugsLoaded ? editing : null;
          const payload = {
            medication: medication.value.trim(),
            dose: dose.value.trim(),
            route: route.value().trim(),
            frequency: frequency.value().trim(),
            reason: reason.value().trim(),
            startDate: startDate.value,
            endDate: endDate.value || null,
            status: status.value,
            notes: notes.value.trim(),
            drugId: drug?.id ?? keepLink?.drugId ?? null,
            doseMilliUnits: drug ? perDoseMilliUnits(drug) : keepLink?.doseMilliUnits ?? null,
          };
          try {
            const saved = editing
              ? await api.patch<{ treatment: TreatmentDto }>(`/api/treatments/${editing.id}`, payload)
              : await api.post<{ treatment: TreatmentDto }>("/api/treatments", {
                  ...payload,
                  rabbitId: Number(rabbitSelect.value),
                });
            options.onSaved(saved.treatment);
            toast(editing ? "Treatment updated" : "Treatment added");
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
      h("div", { class: "field" }, h("label", null, "Bunny"), rabbitSelect),
      h("div", { class: "field" }, h("label", null, "Linked drug"), drugSelect),
      info,
      weightField,
      summary,
      h("div", { class: "field" }, h("label", null, "Medication"), medication),
      h("div", { class: "field" }, h("label", null, "Dose"), dose),
      h("div", { class: "field" }, h("label", null, "Route"), route.root),
      h("div", { class: "field" }, h("label", null, "Frequency"), frequency.root),
      h("div", { class: "field" }, h("label", null, "Reason"), reason.root),
      h("div", { class: "field" }, h("label", null, "Start date"), startDate),
      h("div", { class: "field" }, h("label", null, "End date"), endDate),
      h("div", { class: "field" }, h("label", null, "Status"), status),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });

  void loadDrugs();
  void loadWeight();
}

function todayInputValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
