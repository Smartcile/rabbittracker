import type { FoodProductDto, RabbitDto, TaskDto, TaskSlot, TaskTemplateDto } from "../../../shared/types.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { optionButtons, toggleButton } from "./toggle.ts";

export function openTaskModal(options: {
  rabbit: RabbitDto;
  task?: TaskDto;
  onSaved: () => void;
}): void {
  const editing = options.task;
  const label = h("input", {
    required: true,
    value: editing?.label ?? "",
    placeholder: "e.g. Change litter box",
  });
  let slot: TaskSlot = editing?.slot ?? "anytime";
  const slotGroup = optionButtons(
    TASK_SLOTS.map((value) => ({ value, label: TASK_SLOT_LABELS[value] })),
    [slot],
    false,
    (values) => {
      slot = (values[0] as TaskSlot | undefined) ?? "anytime";
    },
  );
  const interval = h("input", {
    type: "number",
    min: "1",
    max: "3650",
    value: String(editing?.intervalDays ?? 1),
  });
  const templateSelect = editing
    ? null
    : h("select", null, h("option", { value: "" }, "— Custom task —"));
  const productSelect = h("select", null, h("option", { value: "" }, "— No stock item —"));
  const amount = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 500",
    value: editing && editing.amountGrams > 0 ? String(editing.amountGrams) : "",
  });
  const amountField = h(
    "div",
    { class: "field" },
    h("label", null, "Amount used (g)"),
    amount,
    h(
      "span",
      { class: "dim small" },
      "Deducted from the product's stock each time this task is completed.",
    ),
  );
  const notes = h("textarea", null, editing?.notes ?? "");
  const active = toggleButton({ label: "Active", checked: editing?.active ?? true });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save" : "Add task");

  const renderAmount = (): void => {
    amountField.style.display = productSelect.value ? "" : "none";
  };
  productSelect.addEventListener("change", renderAmount);
  renderAmount();

  void Promise.all([
    api.get<{ templates: TaskTemplateDto[] }>("/api/task-templates"),
    api.get<{ products: FoodProductDto[] }>("/api/food-products"),
  ])
    .then(([{ templates }, { products }]) => {
      for (const product of products) {
        productSelect.append(h("option", { value: String(product.id) }, product.name));
      }
      productSelect.value = editing?.productId != null ? String(editing.productId) : "";
      if (templateSelect) {
        for (const template of templates) {
          templateSelect.append(h("option", { value: String(template.id) }, template.label));
        }
        templateSelect.addEventListener("change", () => {
          const template = templates.find((item) => String(item.id) === templateSelect.value);
          if (!template) return;
          label.value = template.label;
          slot = template.slot;
          slotGroup.setValues([template.slot]);
          interval.value = String(template.intervalDays);
          productSelect.value = template.productId != null ? String(template.productId) : "";
          amount.value = template.amountGrams > 0 ? String(template.amountGrams) : "";
          notes.value = template.notes;
          renderAmount();
        });
      }
      renderAmount();
    })
    .catch(() => {
      templateSelect?.setAttribute("disabled", "true");
    });

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.label}` : `Add task — ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const name = label.value.trim();
          if (!name) {
            error.textContent = "Give the task a name.";
            error.style.display = "";
            return;
          }
          const intervalDays = Number(interval.value);
          if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
            error.textContent = "Repeat every 1–3650 days.";
            error.style.display = "";
            return;
          }
          const productId = productSelect.value ? Number(productSelect.value) : null;
          const amountText = amount.value.trim();
          const amountGrams = productId !== null && amountText ? Math.round(Number(amountText)) : 0;
          if (productId !== null && amountText && (!Number.isFinite(amountGrams) || amountGrams < 0)) {
            error.textContent = "Enter the amount used in grams.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            const payload = {
              label: name,
              slot,
              intervalDays,
              productId,
              amountGrams,
              notes: notes.value.trim(),
              active: active.checked(),
            };
            if (editing) {
              await api.patch(`/api/tasks/${editing.id}`, payload);
            } else {
              await api.post("/api/tasks", {
                ...payload,
                rabbitId: options.rabbit.id,
                templateId: templateSelect?.value ? Number(templateSelect.value) : null,
              });
            }
            toast(editing ? "Task saved" : "Task added");
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
      templateSelect
        ? h("div", { class: "field" }, h("label", null, "Start from a template"), templateSelect)
        : null,
      h("div", { class: "field" }, h("label", null, "Name"), label),
      h("div", { class: "field" }, h("label", null, "Time of day"), slotGroup.root),
      h(
        "div",
        { class: "field" },
        h("label", null, "Repeat"),
        interval,
        h("span", { class: "dim small" }, "Every N days — 1 means every day."),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Uses stock item (optional)"),
        productSelect,
        h("span", { class: "dim small" }, "Link a food or supply product so completing the task draws it down."),
      ),
      amountField,
      h("div", { class: "field" }, h("label", null, "Status"), h("div", { class: "row wrap" }, active.root)),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "modal-actions" },
        editing
          ? h("button", { class: "btn danger", type: "button", onClick: () => void remove() }, "Delete")
          : null,
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });

  async function remove(): Promise<void> {
    if (!editing) return;
    const confirmed = await confirmDialog({
      title: `Delete ${editing.label}?`,
      message: "Completion history is removed. Medication doses already logged stay in the record.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/tasks/${editing.id}`);
      toast("Task deleted");
      options.onSaved();
      modal.close();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    }
  }
}
