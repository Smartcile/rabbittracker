import type { FoodProductDto, RabbitDto, TaskDto, TaskSlot, TaskTemplateDto } from "../../../shared/types.ts";
import { DEFAULT_RECURRENCE } from "../../../shared/recurrence.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS, taskSlotForTime } from "../../../shared/tasks.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { loadLookups } from "../lookups.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { recurrenceEditor } from "./recurrenceEditor.ts";
import { taskProductRows } from "./taskProductRows.ts";
import { toast } from "./toast.ts";
import { optionButtons, toggleButton } from "./toggle.ts";

export function openTaskModal(options: {
  rabbit?: RabbitDto;
  rabbits?: RabbitDto[];
  task?: TaskDto;
  careKind?: string;
  label?: string;
  onSaved: () => void;
}): void {
  const editing = options.task;
  let careKind = editing?.careKind ?? options.careKind ?? "";
  const label = h("input", {
    required: true,
    value: editing?.label ?? options.label ?? "",
    placeholder: "e.g. Change litter box",
  });
  let slot: TaskSlot = editing?.slot ?? taskSlotForTime(new Date());
  const slotGroup = optionButtons(
    TASK_SLOTS.map((value) => ({ value, label: TASK_SLOT_LABELS[value] })),
    [slot],
    false,
    (values) => {
      slot = (values[0] as TaskSlot | undefined) ?? "anytime";
    },
  );
  const recurrence = recurrenceEditor(editing?.recurrence ?? DEFAULT_RECURRENCE);
  const start = h("input", { type: "date", value: editing?.startDate ?? "" });
  const templateSelect = editing
    ? null
    : h("select", null, h("option", { value: "" }, "— Custom task —"));
  const bunnySelect =
    !editing && !options.rabbit
      ? h(
          "select",
          null,
          h("option", { value: "" }, "— Choose a bunny —"),
          (options.rabbits ?? []).map((rabbit) =>
            h("option", { value: String(rabbit.id) }, rabbit.name),
          ),
        )
      : null;

  const careSelect = h("select", null, h("option", { value: "" }, "— Routine task —"));
  careSelect.value = careKind;
  void loadLookups()
    .then((lookups) => {
      const careTypes = lookups.filter((lookup) => lookup.kind === "care_type");
      for (const careType of careTypes) {
        careSelect.append(h("option", { value: careType.value }, careType.label));
      }
      careSelect.value = careKind;
      careSelect.addEventListener("change", () => {
        careKind = careSelect.value;
        const careType = careTypes.find((item) => item.value === careKind);
        if (careType) label.value = careType.label;
      });
    })
    .catch(() => {
      careSelect.setAttribute("disabled", "true");
    });

  const productRows = taskProductRows(editing?.products ?? []);
  const addProduct = h(
    "button",
    { class: "btn outline small", type: "button", onClick: () => productRows.add() },
    "Add product",
  );

  const notes = h("textarea", null, editing?.notes ?? "");
  const active = toggleButton({ label: "Active", checked: editing?.active ?? true });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save" : "Add task");

  void Promise.all([
    api.get<{ templates: TaskTemplateDto[] }>("/api/task-templates"),
    api.get<{ products: FoodProductDto[] }>("/api/food-products"),
  ])
    .then(([{ templates }, { products }]) => {
      productRows.setProducts(products);
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
          recurrence.setValue(template.recurrence);
          start.value = template.startDate ?? "";
          productRows.setValues(template.products);
          notes.value = template.notes;
        });
      }
    })
    .catch(() => {
      templateSelect?.setAttribute("disabled", "true");
    });

  const modal = openModal({
    guardUnsaved: true,
    title: editing
      ? `Edit ${editing.label}`
      : options.rabbit
        ? `Add task — ${options.rabbit.name}`
        : "Add task",
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
          const rabbitId = editing?.rabbitId ?? options.rabbit?.id ?? Number(bunnySelect?.value);
          if (!Number.isInteger(rabbitId) || rabbitId <= 0) {
            error.textContent = "Choose a bunny.";
            error.style.display = "";
            return;
          }
          const products = productRows.collect();
          if (products === null) {
            error.textContent = "Enter each product amount in grams.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            const payload = {
              label: name,
              careKind: careKind || null,
              slot,
              recurrence: recurrence.value(),
              startDate: start.value || null,
              products,
              notes: notes.value.trim(),
              active: active.checked(),
            };
            if (editing) {
              await api.patch(`/api/tasks/${editing.id}`, payload);
            } else {
              await api.post("/api/tasks", {
                ...payload,
                rabbitId,
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
      bunnySelect ? h("div", { class: "field" }, h("label", null, "Bunny"), bunnySelect) : null,
      h(
        "div",
        { class: "field" },
        h("label", null, "Care routine (optional)"),
        careSelect,
        h(
          "span",
          { class: "dim small" },
          "Ties this routine to a care type so it appears in the Routine care overview.",
        ),
      ),
      h("div", { class: "field" }, h("label", null, "Name"), label),
      h("div", { class: "field" }, h("label", null, "Time of day"), slotGroup.root),
      h("div", { class: "field" }, h("label", null, "Repeats"), recurrence.root),
      h(
        "div",
        { class: "field" },
        h("label", null, "Start date (optional)"),
        start,
        h("span", { class: "dim small" }, "When the routine begins — sets the first due date."),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Stock items (optional)"),
        h(
          "span",
          { class: "dim small" },
          "Link one or more food or supply products so completing the task draws each down.",
        ),
        productRows.root,
        addProduct,
      ),
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

