import type { FoodProductDto, TaskSlot, TaskTemplateDto } from "../../../shared/types.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { api } from "../api.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import { optionButtons, toggleButton } from "../components/toggle.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

export function renderRoutinePage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack" });
  let products: FoodProductDto[] = [];
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => openTemplateModal(undefined, load, products) },
    "Add task",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title", style: { flexWrap: "wrap" } },
      h("h1", null, "Daily routine"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Reusable routine tasks (change litter box, clean water bottles, …). Add one to a bunny from its Daily routine card, and link a stock item so completing the task draws it down.",
    ),
    list,
  );

  async function load(): Promise<void> {
    const [{ templates }, { products: rows }] = await Promise.all([
      api.get<{ templates: TaskTemplateDto[] }>("/api/task-templates"),
      api.get<{ products: FoodProductDto[] }>("/api/food-products"),
    ]);
    products = rows;
    if (templates.length === 0) {
      list.replaceChildren(h("div", { class: "empty" }, "No routine tasks yet."));
      return;
    }
    list.replaceChildren(
      ...templates.map((template) => card(template)),
    );
  }

  function card(template: TaskTemplateDto): HTMLElement {
    const bits = [
      TASK_SLOT_LABELS[template.slot],
      template.intervalDays === 1 ? "Every day" : `Every ${template.intervalDays} days`,
      template.productName
        ? `${template.productName}${template.amountGrams > 0 ? ` · ${template.amountGrams} g` : ""}`
        : null,
      template.active ? null : "Inactive",
    ].filter(Boolean);
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row wrap" },
        h("strong", null, template.label),
        h("span", { class: "dim small" }, bits.join(" · ")),
        h("span", { class: "spacer" }),
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => openTemplateModal(template, load, products) },
          "Edit",
        ),
        h("button", { class: "btn ghost small", type: "button", onClick: () => void remove(template) }, "Delete"),
      ),
      template.notes ? h("p", { class: "dim small", style: { margin: "0.3rem 0 0" } }, template.notes) : null,
    );
  }

  async function remove(template: TaskTemplateDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${template.label}"?`,
      message: "The template is removed. Tasks already added to bunnies stay.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/task-templates/${template.id}`);
    toast("Routine task deleted");
    await load();
  }

  void load();
  return container;
}

function openTemplateModal(
  template: TaskTemplateDto | undefined,
  reload: () => Promise<void>,
  products: FoodProductDto[],
): void {
  const label = h("input", {
    required: true,
    value: template?.label ?? "",
    placeholder: "e.g. Change litter box",
  });
  let slot: TaskSlot = template?.slot ?? "anytime";
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
    value: String(template?.intervalDays ?? 1),
  });
  const productSelect = h("select", null, h("option", { value: "" }, "— No stock item —"));
  for (const product of products) {
    productSelect.append(h("option", { value: String(product.id) }, product.name));
  }
  productSelect.value = template?.productId != null ? String(template.productId) : "";
  const amount = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 500",
    value: template && template.amountGrams > 0 ? String(template.amountGrams) : "",
  });
  const amountField = h(
    "div",
    { class: "field" },
    h("label", null, "Amount used (g)"),
    amount,
    h("span", { class: "dim small" }, "Deducted from the product's stock each time a task is completed."),
  );
  const renderAmount = (): void => {
    amountField.style.display = productSelect.value ? "" : "none";
  };
  productSelect.addEventListener("change", renderAmount);
  renderAmount();
  const notes = h("textarea", null, template?.notes ?? "");
  const active = toggleButton({ label: "Active", checked: template?.active ?? true });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, template ? "Save" : "Add");

  const modal = openModal({
    guardUnsaved: true,
    title: template ? `Edit ${template.label}` : "Add routine task",
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
          const payload = {
            label: name,
            slot,
            intervalDays,
            productId,
            amountGrams,
            notes: notes.value.trim(),
            active: active.checked(),
          };
          try {
            if (template) {
              await api.patch(`/api/task-templates/${template.id}`, payload);
            } else {
              await api.post("/api/task-templates", payload);
            }
            toast(template ? "Routine task saved" : "Routine task added");
            modal.close();
            await reload();
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
        h("span", { class: "dim small" }, "Completing a task added from this template draws the product down."),
      ),
      amountField,
      h("div", { class: "field" }, h("label", null, "Status"), h("div", { class: "row wrap" }, active.root)),
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
