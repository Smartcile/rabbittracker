import type {
  DrugDto,
  MedicationLogDto,
  RabbitDto,
  TreatmentDto,
  TreatmentSlot,
} from "../../../shared/types.ts";
import { formatDrugAmount } from "../../../shared/drugs.ts";
import {
  TREATMENT_SLOT_LABELS,
  nextPendingTreatmentSlot,
} from "../../../shared/treatments.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { optionButtons, toggleButton } from "./toggle.ts";
import { openTreatmentModal } from "./treatmentModal.ts";

export function openMedicationLogModal(options: {
  rabbit: RabbitDto;
  treatments: TreatmentDto[];
  drugs: DrugDto[];
  logs?: MedicationLogDto[];
  treatmentId?: number;
  editing?: MedicationLogDto;
  date?: Date;
  onSaved: () => void;
}): void {
  const editing = options.editing;
  const linkedId = editing?.treatmentId ?? options.treatmentId ?? null;
  const selectable = options.treatments.filter(
    (treatment) =>
      treatment.rabbitId === options.rabbit.id &&
      (treatment.status === "active" || treatment.id === linkedId),
  );
  const treatmentSelect = h(
    "select",
    null,
    h("option", { value: "" }, "— Not linked to a treatment —"),
    selectable.map((treatment) =>
      h(
        "option",
        { value: String(treatment.id) },
        treatment.dose ? `${treatment.medication} · ${treatment.dose}` : treatment.medication,
      ),
    ),
  );
  treatmentSelect.value = String(linkedId ?? selectable[0]?.id ?? "");

  const drugSelect = h(
    "select",
    null,
    h("option", { value: "" }, "— No drug —"),
    options.drugs.map((drug) => h("option", { value: String(drug.id) }, drug.name)),
  );
  const amount = h("input", { inputmode: "decimal", placeholder: "e.g. 0.3" });
  const amountHint = h("span", { class: "dim small" });
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(initialWhen(editing, options.date));
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h(
    "button",
    { class: "btn primary", type: "submit" },
    editing ? "Save dose" : "Log dose",
  );

  let slot: TreatmentSlot | null = editing?.slot ?? null;
  const slotField = h("div", { class: "field" });
  const overrideToggle = toggleButton({ label: "Use this amount from now on", checked: true });
  const overrideField = h(
    "div",
    { class: "field" },
    h("label", null, "Future doses"),
    h("div", { class: "row wrap" }, overrideToggle.root),
    h(
      "span",
      { class: "dim small" },
      "Updates the treatment's dose from this day on. Turn off for a one-off amount.",
    ),
  );
  overrideField.style.display = "none";

  const selectedTreatment = (): TreatmentDto | undefined =>
    selectable.find((treatment) => String(treatment.id) === treatmentSelect.value);
  const selectedDrug = (): DrugDto | undefined =>
    options.drugs.find((drug) => String(drug.id) === drugSelect.value);

  const parsedAmount = (): number | null => {
    const text = amount.value.trim();
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 1000);
  };

  const dayLogs = (treatmentId: number): MedicationLogDto[] => {
    const reference = when.value
      ? new Date(when.value)
      : editing
        ? new Date(editing.givenAt)
        : (options.date ?? new Date());
    const day = localDayKey(reference);
    return (options.logs ?? []).filter(
      (log) =>
        log.treatmentId === treatmentId &&
        log.id !== editing?.id &&
        localDayKey(new Date(log.givenAt)) === day,
    );
  };

  const editTreatment = h(
    "button",
    {
      class: "btn ghost small",
      type: "button",
      onClick: () => {
        const treatment = selectedTreatment();
        if (!treatment) return;
        modal.close();
        openTreatmentModal({
          rabbits: [options.rabbit],
          treatment,
          onSaved: () => options.onSaved(),
        });
      },
    },
    "Edit treatment",
  );
  const editTreatmentField = h("div", { class: "field" }, editTreatment);
  editTreatmentField.style.display = "none";

  const renderSlotPicker = (): void => {
    const treatment = selectedTreatment();
    editTreatmentField.style.display = treatment ? "" : "none";
    const available = treatment?.slots ?? [];
    if (available.length === 0) {
      slot = null;
      slotField.style.display = "none";
      return;
    }
    slotField.style.display = "";
    const pending = nextPendingTreatmentSlot(available, dayLogs(treatment!.id));
    const keep = slot !== null && available.includes(slot) ? slot : (pending ?? available[0]);
    slot = keep;
    const group = optionButtons(
      available.map((value) => ({ value, label: TREATMENT_SLOT_LABELS[value] })),
      [keep],
      false,
      (values) => {
        slot = (values[0] as TreatmentSlot | undefined) ?? null;
      },
    );
    slotField.replaceChildren(h("label", null, "Time of day"), group.root);
  };

  const overrideFor = (): { treatment: TreatmentDto; drug: DrugDto; amount: number } | null => {
    if (editing) return null;
    const treatment = selectedTreatment();
    if (!treatment || treatment.drugId === null) return null;
    const drug = options.drugs.find((item) => item.id === treatment.drugId);
    if (!drug) return null;
    const value = parsedAmount();
    if (value === null || value <= 0 || value === treatment.doseMilliUnits) return null;
    return { treatment, drug, amount: value };
  };

  const syncOverride = (): void => {
    overrideField.style.display = overrideFor() ? "" : "none";
  };

  const syncHint = (): void => {
    const drug = selectedDrug();
    const text = amount.value.trim();
    if (drug && text) {
      amountHint.textContent = `Deducts ${text} ${drug.unit} from ${drug.name} stock (earliest expiry first).`;
    } else {
      amountHint.textContent = "Amount is optional; leave blank to just note the dose.";
    }
    syncOverride();
  };

  const syncFromTreatment = (): void => {
    const treatment = selectedTreatment();
    if (treatment?.drugId != null) drugSelect.value = String(treatment.drugId);
    if (treatment?.doseMilliUnits != null) {
      amount.value = String(Number((treatment.doseMilliUnits / 1000).toFixed(3)));
    }
    renderSlotPicker();
    syncHint();
  };

  treatmentSelect.addEventListener("change", syncFromTreatment);
  drugSelect.addEventListener("change", syncHint);
  amount.addEventListener("input", syncHint);
  when.addEventListener("change", renderSlotPicker);
  if (editing) {
    drugSelect.value = editing.drugId != null ? String(editing.drugId) : "";
    amount.value =
      editing.amountMilliUnits != null
        ? String(Number((editing.amountMilliUnits / 1000).toFixed(3)))
        : "";
    renderSlotPicker();
    syncHint();
  } else {
    syncFromTreatment();
  }

  const modal = openModal({
    title: `${editing ? "Edit dose" : "Log medication"} — ${options.rabbit.name}`,
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
          const amountMilliUnits = parsedAmount();
          if (amountText && amountMilliUnits === null) {
            error.textContent = "Enter a valid amount.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            const override = overrideFor();
            if (override && overrideToggle.checked()) {
              await api.patch(`/api/treatments/${override.treatment.id}`, {
                doseMilliUnits: override.amount,
                dose: formatDrugAmount(override.amount, override.drug.unit),
              });
            }
            const payload = {
              treatmentId: treatmentSelect.value ? Number(treatmentSelect.value) : null,
              drugId: drugSelect.value ? Number(drugSelect.value) : null,
              givenAt: givenAt.toISOString(),
              slot,
              amountMilliUnits,
              notes: notes.value.trim(),
            };
            if (editing) {
              await api.patch(`/api/medication-logs/${editing.id}`, payload);
            } else {
              await api.post("/api/medication-logs", { ...payload, rabbitId: options.rabbit.id });
            }
            toast(editing ? "Dose updated" : "Dose logged");
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
      editTreatmentField,
      h("div", { class: "field" }, h("label", null, "Drug"), drugSelect),
      slotField,
      h("div", { class: "field" }, h("label", null, "Amount given"), amount, amountHint),
      overrideField,
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

function initialWhen(editing: MedicationLogDto | undefined, date: Date | undefined): Date {
  if (editing) return new Date(editing.givenAt);
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

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
