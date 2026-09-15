import { dailyCheckAnswerKey, emptyChecklist } from "../../../shared/checklist.ts";
import type { ChecklistAnswerDto } from "../../../shared/checklist.ts";
import type {
  CheckLogTypeDto,
  ChecklistSectionDto,
  HealthCheckDto,
  RabbitDto,
} from "../../../shared/types.ts";
import { parseWeightInput, weightInputValue } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { loadChecklist } from "../checklist.ts";
import { loadCheckLogTypes } from "../dailyLogs.ts";
import { h } from "../dom.ts";
import { renderChecklistPhotos } from "./checklistPhotos.ts";
import { openModal } from "./modal.ts";
import { photoPicker } from "./photoPicker.ts";
import { toast } from "./toast.ts";
import { optionButtons, toggleButton } from "./toggle.ts";

export function openCheckModal(options: {
  rabbits: RabbitDto[];
  rabbitId?: number;
  check?: HealthCheckDto;
  previousWeightGrams?: number | null;
  onSaved: (check: HealthCheckDto) => void;
}): void {
  void Promise.all([loadChecklist(), loadCheckLogTypes()])
    .then(([sections, types]) => buildModal(options, sections, types))
    .catch((err) => {
      toast(err instanceof Error ? err.message : "Could not load the check form", "error");
    });
}

function buildModal(
  options: {
    rabbits: RabbitDto[];
    rabbitId?: number;
    check?: HealthCheckDto;
    previousWeightGrams?: number | null;
    onSaved: (check: HealthCheckDto) => void;
  },
  sections: ChecklistSectionDto[],
  types: CheckLogTypeDto[],
): void {
  const editing = options.check;
  const rabbitSelect = h(
    "select",
    { name: "rabbitId" },
    options.rabbits.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)),
  );
  rabbitSelect.value = String(editing?.rabbitId ?? options.rabbitId ?? options.rabbits[0]?.id ?? "");

  const when = h("input", { type: "datetime-local", name: "checkedAt" });
  when.value = toLocalInputValue(editing ? new Date(editing.checkedAt) : new Date());

  const weight = h("input", {
    name: "weight",
    inputmode: "decimal",
    placeholder: "e.g. 2.35",
    value: weightInputValue(editing?.weightGrams),
  });
  const previousWeight = options.previousWeightGrams;
  const weightHint =
    previousWeight != null
      ? `Previous weight: ${(previousWeight / 1000).toFixed(2)} kg. Kilograms by default — 2350g also works.`
      : "Kilograms by default — 2350g also works.";

  const appetite = selectFrom(["normal", "reduced", "none"], editing?.appetite ?? "");
  const droppings = selectFrom(["normal", "small", "few", "none"], editing?.droppings ?? "");
  const energy = selectFrom(["normal", "low", "high"], editing?.energy ?? "");
  const bodyCondition = selectFrom(["1", "2", "3", "4", "5"], editing?.bodyCondition ? String(editing.bodyCondition) : "");
  const temperature = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 38.5",
    value: editing?.temperatureTenthsC != null ? (editing.temperatureTenthsC / 10).toFixed(1) : "",
  });
  const painScore = selectFrom(
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    editing?.painScore != null ? String(editing.painScore) : "",
  );
  const notes = h("textarea", { name: "notes" }, editing?.notes ?? "");

  const picker = photoPicker({
    label: editing?.hasPhoto ? "Replace photo" : "Add photo",
    initialUrl: editing?.hasPhoto ? `/api/photos/check/${editing.id}?size=thumb` : null,
  });

  const checklistFields = sections.map((section) => ({
    section,
    field: checklistField(section, editing?.checklist?.[section.key]),
  }));

  const dailyFields = new Map<string, { root: HTMLElement; read: () => ChecklistAnswerDto }>();
  const dailyHost = h("div", { class: "stack", style: { gap: "0.6rem" } });
  const dailyToggles = h("div", { class: "row wrap" });
  const includedDaily = new Set<string>();
  const renderDaily = () => {
    dailyHost.replaceChildren(
      ...[...includedDaily]
        .map((key) => dailyFields.get(key)?.root)
        .filter((root): root is HTMLElement => root !== undefined),
    );
  };
  for (const type of types) {
    const existing = editing?.checklist?.[dailyCheckAnswerKey(type.key)];
    const filled =
      existing != null &&
      (existing.values.length > 0 ||
        existing.numberMilli != null ||
        (existing.text ?? "").trim().length > 0);
    if (filled) includedDaily.add(type.key);
    dailyFields.set(type.key, dailyCheckField(type, existing));
    dailyToggles.append(
      toggleButton({
        label: type.label,
        checked: filled,
        onChange: (checked) => {
          if (checked) includedDaily.add(type.key);
          else includedDaily.delete(type.key);
          renderDaily();
        },
      }).root,
    );
  }
  renderDaily();

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save check" : "Log check");
  let dirty = false;
  const warningRow = h("div", { class: "modal-warning-row" });
  warningRow.style.display = "none";

  const form = h(
    "form",
    {
      onSubmit: async (event: Event) => {
        event.preventDefault();
        error.style.display = "none";
        const weightText = weight.value.trim();
        const weightGrams = weightText ? parseWeightInput(weightText) : null;
        if (weightText && weightGrams === null) {
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
        const temperatureText = temperature.value.trim();
        const temperatureTenthsC = temperatureText ? Math.round(Number(temperatureText) * 10) : null;
        if (
          temperatureText &&
          (temperatureTenthsC === null ||
            !Number.isFinite(temperatureTenthsC) ||
            temperatureTenthsC < 200 ||
            temperatureTenthsC > 450)
        ) {
          error.textContent = "Enter temperature in °C (e.g. 38.5).";
          error.style.display = "";
          return;
        }
        save.disabled = true;
        const checklist = emptyChecklist();
        for (const { section, field } of checklistFields) {
          checklist[section.key] = field.read();
        }
        for (const type of types) {
          if (!includedDaily.has(type.key)) continue;
          const answer = dailyFields.get(type.key)?.read();
          if (!answer) continue;
          if (
            answer.values.length === 0 &&
            answer.numberMilli == null &&
            !(answer.text ?? "").trim()
          ) {
            continue;
          }
          checklist[dailyCheckAnswerKey(type.key)] = answer;
        }
        const payload = {
          checkedAt: checkedAt.toISOString(),
          weightGrams,
          appetite: appetite.value || null,
          droppings: droppings.value || null,
          energy: energy.value || null,
          bodyCondition: bodyCondition.value ? Number(bodyCondition.value) : null,
          temperatureTenthsC,
          painScore: painScore.value ? Number(painScore.value) : null,
          checklist,
          notes: notes.value.trim(),
        };
        try {
          let result = editing
            ? await api.patch<{ check: HealthCheckDto }>(`/api/checks/${editing.id}`, payload)
            : await api.post<{ check: HealthCheckDto }>("/api/checks", {
                ...payload,
                rabbitId: Number(rabbitSelect.value),
              });
          const file = picker.file();
          if (file) {
            const form = new FormData();
            form.append("photo", file);
            result = await api.upload<{ check: HealthCheckDto }>(
              `/api/checks/${result.check.id}/photo`,
              form,
            );
          }
          dirty = false;
          options.onSaved(result.check);
          toast(editing ? "Check updated" : "Check logged");
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
    h("div", { class: "field" }, h("label", null, "When"), when),
    h(
      "div",
      { class: "field" },
      h("label", null, "Weight"),
      weight,
      h("span", { class: "dim small" }, weightHint),
    ),
    h("div", { class: "field" }, h("label", null, "Appetite"), appetite),
    h("div", { class: "field" }, h("label", null, "Droppings"), droppings),
    h("div", { class: "field" }, h("label", null, "Energy"), energy),
    h("div", { class: "field" }, h("label", null, "Body condition (1–5)"), bodyCondition),
    h(
      "div",
      { class: "field" },
      h("label", null, "Temperature (°C)"),
      temperature,
      h("span", { class: "dim small" }, "Optional — normal is roughly 38.0–39.5°C."),
    ),
    h("div", { class: "field" }, h("label", null, "Pain score (0–10)"), painScore),
    h(
      "div",
      { class: "checklist" },
      h("h3", null, "Weekly health checklist"),
      h(
        "p",
        { class: "dim small" },
        "Optional — tick everything you see in each area, or leave a section blank if it does not apply.",
      ),
      checklistFields.map(({ field }) => field.root),
    ),
    types.length > 0
      ? h(
          "div",
          { class: "checklist" },
          h("h3", null, "Daily checks"),
          h(
            "p",
            { class: "dim small" },
            "Optional — switch on the daily checks you want to record with this health check.",
          ),
          dailyToggles,
          dailyHost,
        )
      : null,
    h("div", { class: "field" }, h("label", null, "Vet notes / other concerns"), notes),
    h("div", { class: "field" }, h("label", null, "Photo"), picker.root),
    warningRow,
    h(
      "div",
      { class: "modal-actions" },
      h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
      save,
    ),
  );

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? "Edit health check" : "Log a health check",
    body: form,
    beforeClose: () => {
      if (!dirty) return true;
      warningRow.style.display = "";
      return false;
    },
  });

  const discard = h(
    "button",
    {
      class: "btn danger small",
      type: "button",
      onClick: () => {
        dirty = false;
        modal.close();
      },
    },
    "Discard changes",
  );
  warningRow.append(h("span", null, "You have unsaved changes."), discard);

  form.addEventListener("input", () => {
    dirty = true;
  });
  form.addEventListener("change", () => {
    dirty = true;
  });
}

function checklistField(
  section: ChecklistSectionDto,
  initial: ChecklistAnswerDto | undefined,
): { root: HTMLElement; read: () => ChecklistAnswerDto } {
  const selected = initial?.values ?? [];
  const otherInput = h("input", {
    type: "text",
    placeholder: "Describe…",
    value: initial?.other ?? "",
  });
  const otherField = h(
    "div",
    { class: "field checklist-other" },
    h("label", null, "Other details"),
    otherInput,
  );
  const group = optionButtons(section.options, selected, section.multiple, (values) => {
    otherField.style.display = values.includes("other") ? "" : "none";
  });
  otherField.style.display = selected.includes("other") ? "" : "none";

  const root = h(
    "div",
    { class: "checklist-section" },
    h(
      "div",
      { class: "checklist-head" },
      h("strong", null, section.label),
      section.hint ? h("span", { class: "dim small" }, section.hint) : null,
    ),
    renderChecklistPhotos(section),
    group.root,
    otherField,
  );

  const read = (): ChecklistAnswerDto => ({
    values: group.read(),
    other: otherInput.value.trim(),
  });

  return { root, read };
}

function dailyCheckField(
  type: CheckLogTypeDto,
  initial: ChecklistAnswerDto | undefined,
): { root: HTMLElement; read: () => ChecklistAnswerDto } {
  let readValues: () => string[] = () => [];
  let readText: () => string = () => "";
  let readNumber: () => number | null = () => null;
  const parts: Node[] = [];
  if (type.options.length > 0) {
    const group = optionButtons(
      type.options.map((label) => ({ value: label, label })),
      initial?.values ?? [],
      type.multiple,
    );
    readValues = () => group.read();
    parts.push(group.root);
  } else if (type.hasText) {
    const input = h("input", {
      type: "text",
      placeholder: "Type / description",
      value: initial?.text ?? "",
    });
    readText = () => input.value.trim();
    parts.push(input);
  }
  if (type.hasNumber) {
    const input = h("input", {
      inputmode: "decimal",
      placeholder: "e.g. 250",
      value:
        initial?.numberMilli != null
          ? String(Number((initial.numberMilli / 1000).toFixed(3)))
          : "",
    });
    readNumber = () => {
      const text = input.value.trim();
      if (!text) return null;
      const value = Math.round(Number(text) * 1000);
      return Number.isFinite(value) && value >= 0 ? value : null;
    };
    parts.push(
      h(
        "div",
        { class: "field" },
        h("label", null, `Amount${type.unit ? ` (${type.unit})` : ""}`),
        input,
      ),
    );
  }
  return {
    root: h(
      "div",
      { class: "checklist-section" },
      h("div", { class: "checklist-head" }, h("strong", null, type.label)),
      ...parts,
    ),
    read: () => ({ values: readValues(), other: "", numberMilli: readNumber(), text: readText() }),
  };
}

function selectFrom(values: string[], selected: string): HTMLSelectElement {
  const select = h(
    "select",
    null,
    h("option", { value: "" }, "Not recorded"),
    values.map((value) => h("option", { value }, capitalize(value))),
  );
  select.value = selected;
  return select;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
