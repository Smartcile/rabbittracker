import type { DrugBatchDto, DrugDto } from "../../../shared/types.ts";
import {
  DRUG_FORM_OPTIONS,
  formatDrugAmount,
  formatMgFromMicrograms,
  formatUnitsFromMilliUnits,
  parseScaledAmount,
} from "../../../shared/drugs.ts";
import { api } from "../api.ts";
import { fmtCalendarDate, h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openDrugModal(options: {
  drug?: DrugDto;
  onSaved: (drug: DrugDto) => void;
  onDeleted?: () => void;
}): void {
  const editing = options.drug;
  let current = editing ?? null;

  const name = h("input", { required: true, value: editing?.name ?? "" });
  const activeIngredient = h("input", { value: editing?.activeIngredient ?? "" });
  const form = h(
    "select",
    null,
    DRUG_FORM_OPTIONS.map((option) => h("option", { value: option.value }, option.label)),
  );
  form.value = editing?.form ?? "liquid";
  const unit = h("input", { value: editing?.unit ?? "ml" });
  let unitTouched = Boolean(editing);
  unit.addEventListener("input", () => {
    unitTouched = true;
  });
  form.addEventListener("change", () => {
    if (unitTouched) return;
    unit.value =
      DRUG_FORM_OPTIONS.find((option) => option.value === form.value)?.defaultUnit ?? "unit";
  });
  const concentration = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 1.5",
    value: formatMgFromMicrograms(editing?.concentrationMicrogramsPerUnit ?? null),
  });
  const dose = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 0.5",
    value: formatMgFromMicrograms(editing?.doseMicrogramsPerKg ?? null),
  });
  const dosesPerDay = h("input", {
    type: "number",
    min: 1,
    max: 12,
    step: 1,
    value: String(editing?.dosesPerDay ?? 1),
  });
  const route = lookupSelect("route", { initialLabel: editing?.route ?? "" });
  const frequency = lookupSelect("frequency", { initialLabel: editing?.frequency ?? "" });
  const durationDays = h("input", {
    type: "number",
    min: 1,
    step: 1,
    value: editing?.durationDays ? String(editing.durationDays) : "",
  });
  const howToUse = h("textarea", null, editing?.howToUse ?? "");
  const warnings = h("textarea", null, editing?.warnings ?? "");
  const reorder = h("input", {
    inputmode: "decimal",
    placeholder: "0",
    value: formatUnitsFromMilliUnits(editing?.reorderLevelMilliUnits ?? 0),
  });

  const batchList = h("div", { class: "stack", style: { gap: "0" } });
  const batchQuantity = h("input", { inputmode: "decimal", placeholder: "e.g. 10" });
  const batchExpiry = h("input", { type: "date" });
  const batchLabel = h("input", { placeholder: "Batch / lot (optional)" });
  const batchSupplier = lookupSelect("supplier", { emptyLabel: "— No supplier —" });

  const initialQuantity = h("input", { inputmode: "decimal", placeholder: "e.g. 10" });
  const initialExpiry = h("input", { type: "date" });
  const initialBatch = h("input", { placeholder: "Batch / lot (optional)" });
  const initialSupplier = lookupSelect("supplier", { emptyLabel: "— No supplier —" });

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save drug" : "Add drug");

  function renderBatches(): void {
    batchList.replaceChildren();
    if (!current || current.batches.length === 0) {
      batchList.append(h("p", { class: "dim small", style: { margin: 0 } }, "No stock recorded yet."));
      return;
    }
    for (const batch of current.batches) {
      batchList.append(
        h(
          "div",
          { class: "list-row" },
          h("span", { class: "mono" }, formatDrugAmount(batch.quantityMilliUnits, current.unit)),
          h(
            "span",
            { class: "dim small" },
            batch.expiryDate ? `expires ${fmtCalendarDate(batch.expiryDate)}` : "no expiry",
          ),
          batch.batch ? h("span", { class: "dim small" }, `lot ${batch.batch}`) : null,
          batch.supplier ? h("span", { class: "dim small" }, batch.supplier) : null,
          h("span", { class: "spacer" }),
          h(
            "button",
            { class: "btn ghost small", type: "button", onClick: () => void removeBatch(batch) },
            "Remove",
          ),
        ),
      );
    }
  }

  async function addBatch(): Promise<void> {
    if (!current) return;
    const quantity = parseScaledAmount(batchQuantity.value, 1000);
    if (quantity === undefined || quantity === null || quantity <= 0) {
      toast("Enter a stock amount", "error");
      return;
    }
    try {
      const saved = await api.post<{ batch: DrugBatchDto }>(`/api/drugs/${current.id}/batches`, {
        quantityMilliUnits: quantity,
        expiryDate: batchExpiry.value || null,
        batch: batchLabel.value.trim(),
        supplier: batchSupplier.value().trim(),
      });
      current = { ...current, batches: [...current.batches, saved.batch] };
      batchQuantity.value = "";
      batchExpiry.value = "";
      batchLabel.value = "";
      batchSupplier.setLabel("");
      renderBatches();
      options.onSaved(current);
      toast("Stock added");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add stock", "error");
    }
  }

  async function removeBatch(batch: DrugBatchDto): Promise<void> {
    if (!current) return;
    const ok = await confirmDialog({
      title: "Remove stock",
      message: `Remove ${formatDrugAmount(batch.quantityMilliUnits, current.unit)} from stock?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/drugs/batches/${batch.id}`);
      current = { ...current, batches: current.batches.filter((row) => row.id !== batch.id) };
      renderBatches();
      options.onSaved(current);
      toast("Stock removed");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove stock", "error");
    }
  }

  async function removeDrug(): Promise<void> {
    if (!editing) return;
    const ok = await confirmDialog({
      title: "Delete drug",
      message: `Delete ${editing.name}? Its stock entries are removed; past treatments keep their history.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/drugs/${editing.id}`);
      options.onDeleted?.();
      toast("Drug deleted");
      modal.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete drug", "error");
    }
  }

  const modal = openModal({
    title: editing ? `Edit ${editing.name}` : "Add drug",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const concentrationValue = parseScaledAmount(concentration.value, 1000);
          const doseValue = parseScaledAmount(dose.value, 1000);
          const reorderValue = parseScaledAmount(reorder.value, 1000, true);
          const initialValue = editing ? null : parseScaledAmount(initialQuantity.value, 1000);
          if (
            concentrationValue === undefined ||
            doseValue === undefined ||
            reorderValue === undefined ||
            initialValue === undefined
          ) {
            error.textContent = "Amounts must be positive numbers, or left blank (reorder level can be 0).";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          const payload = {
            name: name.value.trim(),
            activeIngredient: activeIngredient.value.trim(),
            form: form.value,
            unit: unit.value.trim() || "unit",
            concentrationMicrogramsPerUnit: concentrationValue,
            doseMicrogramsPerKg: doseValue,
            dosesPerDay: Math.max(1, Number(dosesPerDay.value) || 1),
            route: route.value().trim(),
            frequency: frequency.value().trim(),
            durationDays: durationDays.value ? Number(durationDays.value) : null,
            howToUse: howToUse.value.trim(),
            warnings: warnings.value.trim(),
            reorderLevelMilliUnits: reorderValue ?? 0,
          };
          try {
            let saved: DrugDto;
            if (editing) {
              saved = (await api.patch<{ drug: DrugDto }>(`/api/drugs/${editing.id}`, payload)).drug;
            } else {
              saved = (await api.post<{ drug: DrugDto }>("/api/drugs", payload)).drug;
              if (initialValue !== null) {
                const batch = await api.post<{ batch: DrugBatchDto }>(`/api/drugs/${saved.id}/batches`, {
                  quantityMilliUnits: initialValue,
                  expiryDate: initialExpiry.value || null,
                  batch: initialBatch.value.trim(),
                  supplier: initialSupplier.value().trim(),
                });
                saved = { ...saved, batches: [batch.batch] };
              }
            }
            options.onSaved(saved);
            toast(editing ? "Drug updated" : "Drug added");
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
      h("div", { class: "field" }, h("label", null, "Name"), name),
      h("div", { class: "field" }, h("label", null, "Active ingredient"), activeIngredient),
      h("div", { class: "field" }, h("label", null, "Form"), form),
      h("div", { class: "field" }, h("label", null, "Unit (stock and dose)"), unit),
      h("div", { class: "field" }, h("label", null, "Concentration (mg per unit)"), concentration),
      h("div", { class: "field" }, h("label", null, "Typical dose (mg per kg)"), dose),
      h("div", { class: "field" }, h("label", null, "Doses per day"), dosesPerDay),
      h("div", { class: "field" }, h("label", null, "Route"), route.root),
      h("div", { class: "field" }, h("label", null, "Frequency"), frequency.root),
      h("div", { class: "field" }, h("label", null, "Typical course (days)"), durationDays),
      h("div", { class: "field" }, h("label", null, "How to use"), howToUse),
      h("div", { class: "field" }, h("label", null, "Warnings"), warnings),
      h(
        "div",
        { class: "field" },
        h("label", null, "Reorder level (same unit as stock)"),
        reorder,
      ),
      editing
        ? h(
            "div",
            { class: "card", style: { marginTop: "0.6rem" } },
            h("div", { class: "card-title" }, h("h2", null, "Stock")),
            batchList,
            h("div", { class: "field" }, h("label", null, "Add stock amount"), batchQuantity),
            h("div", { class: "field" }, h("label", null, "Expiry (optional)"), batchExpiry),
            h("div", { class: "field" }, h("label", null, "Batch / lot (optional)"), batchLabel),
            h("div", { class: "field" }, h("label", null, "Supplier (optional)"), batchSupplier.root),
            h(
              "button",
              { class: "btn outline small", type: "button", onClick: () => void addBatch() },
              "Add stock",
            ),
          )
        : h(
            "div",
            { class: "card", style: { marginTop: "0.6rem" } },
            h("div", { class: "card-title" }, h("h2", null, "Initial stock (optional)")),
            h("div", { class: "field" }, h("label", null, "Amount"), initialQuantity),
            h("div", { class: "field" }, h("label", null, "Expiry (optional)"), initialExpiry),
            h("div", { class: "field" }, h("label", null, "Batch / lot (optional)"), initialBatch),
            h("div", { class: "field" }, h("label", null, "Supplier (optional)"), initialSupplier.root),
          ),
      h(
        "div",
        { class: "modal-actions" },
        editing
          ? h("button", { class: "btn danger", type: "button", onClick: () => void removeDrug() }, "Delete")
          : null,
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });

  renderBatches();
}
