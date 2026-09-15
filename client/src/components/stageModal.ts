import type { GrowthStageDto, RabbitStageCompletionDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";

function todayInputValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function openStageCompleteModal(options: {
  rabbitId: number;
  stage: GrowthStageDto;
  existing?: RabbitStageCompletionDto;
  onSaved: () => void;
}): void {
  const when = h("input", { type: "date", value: options.existing?.completedAt ?? todayInputValue() });
  const notes = h("textarea", null, options.existing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Mark done");
  const modal = openModal({
    guardUnsaved: true,
    title: `Mark done — ${options.stage.label}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          if (!when.value) {
            error.textContent = "Pick a date.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            await api.put(`/api/rabbits/${options.rabbitId}/stages/${options.stage.id}`, {
              completedAt: when.value,
              notes: notes.value.trim(),
            });
            toast("Stage marked done");
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

function daysToMonths(days: number): string {
  return String(Number((days / 30).toFixed(1)));
}

function monthsToDays(value: string): number {
  return Math.max(0, Math.round(Number(value) * 30));
}

export function openStageModal(options: {
  stage?: GrowthStageDto;
  onSaved: () => void;
  onDeleted?: () => void;
}): void {
  const editing = options.stage;
  const label = h("input", { required: true, value: editing?.label ?? "" });
  const startMonths = h("input", {
    type: "number",
    min: "0",
    step: "0.5",
    value: editing ? daysToMonths(editing.startDays) : "0",
  });
  const endMonths = h("input", {
    type: "number",
    min: "0",
    step: "0.5",
    value: editing ? daysToMonths(editing.endDays) : "1",
  });
  const sex = h(
    "select",
    null,
    h("option", { value: "any" }, "Any bunny"),
    h("option", { value: "male" }, "Male only"),
    h("option", { value: "female" }, "Female only"),
  );
  sex.value = editing?.sex ?? "any";
  const guidance = h("textarea", null, editing?.guidance ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save stage" : "Add stage");

  async function removeStage(): Promise<void> {
    if (!editing) return;
    const confirmed = await confirmDialog({
      title: `Delete ${editing.label}?`,
      message: "The stage and any tick-offs are removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/growth-stages/${editing.id}`);
      options.onDeleted?.();
      toast("Stage deleted");
      modal.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the stage", "error");
    }
  }

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.label}` : "Add growth stage",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const startDays = monthsToDays(startMonths.value);
          const endDays = monthsToDays(endMonths.value);
          if (endDays < startDays) {
            error.textContent = "The end age must be after the start age.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          const payload = {
            label: label.value.trim(),
            guidance: guidance.value.trim(),
            startDays,
            endDays,
            sex: sex.value,
          };
          try {
            if (editing) {
              await api.patch(`/api/growth-stages/${editing.id}`, payload);
            } else {
              await api.post("/api/growth-stages", payload);
            }
            toast(editing ? "Stage saved" : "Stage added");
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
        { class: "filters" },
        h("div", { class: "field" }, h("label", null, "From age (months)"), startMonths),
        h("div", { class: "field" }, h("label", null, "To age (months)"), endMonths),
        h("div", { class: "field" }, h("label", null, "Applies to"), sex),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Guidance"),
        guidance,
        h("span", { class: "dim small" }, "What to do in this stage — diet, vet visits, handling."),
      ),
      h(
        "div",
        { class: "modal-actions" },
        editing
          ? h("button", { class: "btn danger", type: "button", onClick: () => void removeStage() }, "Delete")
          : null,
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
