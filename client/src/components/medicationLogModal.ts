import type { DrugDto, MedicationLogDto, RabbitDto, TreatmentDto } from "../../../shared/types.ts";
import { formatDrugAmount } from "../../../shared/drugs.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import { DAY_SLOT_LABELS, DAY_SLOTS, nextPendingSlot } from "../../../shared/slots.ts";
import { api } from "../api.ts";
import { fmtTime, h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
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
  slot?: DaySlot;
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

  const treatmentInfo = h("p", { class: "dim small", style: { margin: "0.35rem 0 0" } });
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

  let slot: DaySlot | null = options.slot ?? editing?.slot ?? null;
  let overrideAll = false;
  const slotField = h("div", { class: "field" });
  const changeForward = toggleButton({ label: "Change going forward", checked: false });
  const forwardField = h(
    "div",
    { class: "field" },
    h("label", null, "Schedule"),
    h("div", { class: "row wrap" }, changeForward.root),
    h(
      "span",
      { class: "dim small" },
      "Adds this time to the treatment's schedule from today on. Leave off for a one-off.",
    ),
  );
  forwardField.style.display = "none";
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

  const dayList = h("div", { class: "stack", style: { gap: "0" } });
  const dayListLabel = h("p", { class: "task-slot dim small" });

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
    const day = localDayKey(when.value ? new Date(when.value) : new Date());
    return (options.logs ?? []).filter(
      (log) =>
        log.treatmentId === treatmentId &&
        log.id !== editing?.id &&
        localDayKey(new Date(log.givenAt)) === day,
    );
  };

  const renderTreatmentInfo = (): void => {
    const treatment = selectedTreatment();
    const parts = treatment
      ? [treatment.dose, treatment.route, treatment.frequency].filter(Boolean)
      : [];
    treatmentInfo.textContent = parts.join(" · ");
    treatmentInfo.style.display = parts.length > 0 ? "" : "none";
  };

  const renderForward = (): void => {
    const treatment = selectedTreatment();
    const needed = treatment !== undefined && slot !== null && !treatment.slots.includes(slot);
    forwardField.style.display = needed ? "" : "none";
    if (!needed) changeForward.setChecked(false);
  };

  const renderSlotPicker = (): void => {
    const treatment = selectedTreatment();
    if (!treatment) {
      slot = null;
      slotField.style.display = "none";
      forwardField.style.display = "none";
      return;
    }
    if (slot !== null && !treatment.slots.includes(slot)) overrideAll = true;
    const available = overrideAll ? [...DAY_SLOTS] : treatment.slots;
    if (available.length === 0) {
      slotField.style.display = "none";
      forwardField.style.display = "none";
      return;
    }
    slotField.style.display = "";
    const logged = dayLogs(treatment.id);
    const pending = nextPendingSlot(treatment.slots, logged);
    const keep = slot !== null && available.includes(slot) ? slot : (pending ?? available[0]);
    slot = keep;
    const group = optionButtons(
      available.map((value) => {
        const done = logged.some((log) => log.slot === value);
        return { value, label: `${DAY_SLOT_LABELS[value]}${done ? " ✓" : ""}` };
      }),
      [keep],
      false,
      (values) => {
        const next = values[0] as DaySlot | undefined;
        if (!next) {
          overrideAll = true;
          renderSlotPicker();
          return;
        }
        slot = next;
        renderForward();
      },
    );
    const slotChildren: Node[] = [
      h("label", null, overrideAll ? "Time of day (this day only)" : "Time of day"),
      group.root,
    ];
    if (overrideAll) {
      slotChildren.push(
        h("span", { class: "dim small" }, "Showing every time of day — pick any for this dose."),
      );
    }
    slotField.replaceChildren(...slotChildren);
    renderForward();
  };

  const renderDayList = (): void => {
    const treatment = selectedTreatment();
    const list = treatment ? dayLogs(treatment.id) : [];
    dayListLabel.textContent = `Logged on ${dayLabel(when.value)}`;
    dayListLabel.style.display = list.length > 0 ? "" : "none";
    dayList.replaceChildren(
      ...list
        .sort((a, b) => a.givenAt.localeCompare(b.givenAt))
        .map((entry) =>
          h(
            "div",
            { class: "list-row" },
            h(
              "div",
              { class: "stack", style: { gap: "0.15rem" } },
              h(
                "span",
                null,
                entry.slot ? DAY_SLOT_LABELS[entry.slot] : "Dose",
                h("span", { class: "dim small" }, ` · ${fmtTime(entry.givenAt)}`),
              ),
              entry.notes ? h("span", { class: "dim small" }, entry.notes) : null,
            ),
            h("span", { class: "spacer" }),
            h("span", { class: "dim small" }, amountLabel(entry)),
            h(
              "button",
              { class: "btn ghost small", type: "button", onClick: () => void editEntry(entry) },
              "Edit",
            ),
            h(
              "button",
              { class: "btn ghost small", type: "button", onClick: () => void removeEntry(entry) },
              "Delete",
            ),
          ),
        ),
    );
  };

  const amountLabel = (entry: MedicationLogDto): string => {
    if (entry.amountMilliUnits === null) return "";
    const drug = options.drugs.find((item) => item.id === entry.drugId);
    return formatDrugAmount(entry.amountMilliUnits, drug?.unit ?? "dose");
  };

  const editEntry = (entry: MedicationLogDto): void => {
    modal.close();
    openMedicationLogModal({
      rabbit: options.rabbit,
      treatments: options.treatments,
      drugs: options.drugs,
      logs: options.logs,
      editing: entry,
      treatmentId: entry.treatmentId ?? undefined,
      onSaved: options.onSaved,
    });
  };

  const removeEntry = async (entry: MedicationLogDto): Promise<void> => {
    const confirmed = await confirmDialog({
      title: "Delete dose log?",
      message: "The logged amount is returned to drug stock.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/medication-logs/${entry.id}`);
      toast("Dose log deleted");
      options.onSaved();
      modal.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the log", "error");
    }
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
    overrideAll = false;
    renderTreatmentInfo();
    renderSlotPicker();
    renderDayList();
    syncHint();
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

  treatmentSelect.addEventListener("change", syncFromTreatment);
  drugSelect.addEventListener("change", syncHint);
  amount.addEventListener("input", syncHint);
  when.addEventListener("change", () => {
    renderSlotPicker();
    renderDayList();
  });

  if (editing) {
    drugSelect.value = editing.drugId != null ? String(editing.drugId) : "";
    amount.value =
      editing.amountMilliUnits != null
        ? String(Number((editing.amountMilliUnits / 1000).toFixed(3)))
        : "";
    renderTreatmentInfo();
    renderSlotPicker();
    renderDayList();
    syncHint();
  } else {
    syncFromTreatment();
  }
  editTreatmentField.style.display = selectedTreatment() ? "" : "none";
  treatmentSelect.addEventListener("change", () => {
    editTreatmentField.style.display = selectedTreatment() ? "" : "none";
  });

  const modal = openModal({
    guardUnsaved: true,
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
          const treatment = selectedTreatment();
          const addSlotForward =
            treatment !== undefined &&
            changeForward.checked() &&
            slot !== null &&
            !treatment.slots.includes(slot);
          save.disabled = true;
          try {
            if (editing) {
              if (addSlotForward && treatment) {
                await api.patch(`/api/treatments/${treatment.id}`, {
                  slots: [...treatment.slots, slot],
                });
              }
              await api.patch(`/api/medication-logs/${editing.id}`, {
                treatmentId: treatmentSelect.value ? Number(treatmentSelect.value) : null,
                drugId: drugSelect.value ? Number(drugSelect.value) : null,
                givenAt: givenAt.toISOString(),
                slot,
                amountMilliUnits,
                notes: notes.value.trim(),
              });
            } else {
              const override = overrideFor();
              if (override && overrideToggle.checked()) {
                await api.patch(`/api/treatments/${override.treatment.id}`, {
                  doseMilliUnits: override.amount,
                  dose: formatDrugAmount(override.amount, override.drug.unit),
                });
              }
              if (addSlotForward && treatment) {
                await api.patch(`/api/treatments/${treatment.id}`, {
                  slots: [...treatment.slots, slot],
                });
              }
              await api.post("/api/medication-logs", {
                rabbitId: options.rabbit.id,
                treatmentId: treatmentSelect.value ? Number(treatmentSelect.value) : null,
                drugId: drugSelect.value ? Number(drugSelect.value) : null,
                givenAt: givenAt.toISOString(),
                slot,
                amountMilliUnits,
                notes: notes.value.trim(),
              });
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
      h("div", { class: "field" }, h("label", null, "Treatment"), treatmentSelect, treatmentInfo),
      editTreatmentField,
      h("div", { class: "field" }, h("label", null, "Drug"), drugSelect),
      slotField,
      forwardField,
      h("div", { class: "field" }, h("label", null, "Amount given"), amount, amountHint),
      overrideField,
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

function dayLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
