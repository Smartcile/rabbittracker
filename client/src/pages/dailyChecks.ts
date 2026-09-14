import type { CheckLogTypeDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { invalidateCheckLogTypes, loadCheckLogTypes } from "../dailyLogs.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import { toggleButton } from "../components/toggle.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

export function renderDailyChecksPage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack" });
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => openTypeModal(undefined, load) },
    "Add check type",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Daily checks"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Define the daily checks you want to log, e.g. Poo, Water intake or Food. Each type can have option buttons, a number with a unit, free text and notes.",
    ),
    list,
  );

  async function load(): Promise<void> {
    const types = await loadCheckLogTypes(true);
    if (types.length === 0) {
      list.replaceChildren(h("div", { class: "empty" }, "No check types yet."));
      return;
    }
    list.replaceChildren(...types.map(card));
  }

  function card(type: CheckLogTypeDto): HTMLElement {
    const bits = [
      type.options.length > 0
        ? `${type.options.length} options${type.multiple ? " · multi-select" : ""}`
        : null,
      type.hasNumber ? `number${type.unit ? ` (${type.unit})` : ""}` : null,
      type.hasText ? "text" : null,
    ].filter(Boolean);
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row wrap" },
        h("strong", null, type.label),
        h("span", { class: "dim small" }, bits.join(" · ") || "notes only"),
        h("span", { class: "spacer" }),
        h(
          "button",
          {
            class: "btn outline small",
            type: "button",
            onClick: () => openTypeModal(type, load),
          },
          "Edit",
        ),
        h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void remove(type) },
          "Delete",
        ),
      ),
      type.options.length > 0
        ? h("p", { class: "dim small", style: { margin: "0.3rem 0 0" } }, type.options.join(" · "))
        : null,
    );
  }

  async function remove(type: CheckLogTypeDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${type.label}"?`,
      message: "Existing log entries for this type are removed too.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/check-logs/types/${type.id}`);
    invalidateCheckLogTypes();
    toast("Check type deleted");
    await load();
  }

  void load();
  return container;
}

function openTypeModal(type: CheckLogTypeDto | undefined, reload: () => Promise<void>): void {
  const label = h("input", { required: true, value: type?.label ?? "" });
  const unit = h("input", { value: type?.unit ?? "", placeholder: "ml, g, …" });
  const hasNumber = toggleButton({ label: "Number", checked: type?.hasNumber ?? true });
  const hasText = toggleButton({ label: "Free text", checked: type?.hasText ?? false });
  const multiple = toggleButton({ label: "Allow multiple", checked: type?.multiple ?? false });
  const options = h("input", {
    value: type?.options.join(", ") ?? "",
    placeholder: "Normal, Soft, Runny",
  });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, type ? "Save" : "Add");
  const modal = openModal({
    title: type ? `Edit ${type.label}` : "Add check type",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          const payload = {
            label: label.value.trim(),
            unit: unit.value.trim(),
            hasNumber: hasNumber.checked(),
            hasText: hasText.checked(),
            multiple: multiple.checked(),
            options: options.value
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          };
          try {
            if (type) {
              await api.patch(`/api/check-logs/types/${type.id}`, payload);
            } else {
              await api.post("/api/check-logs/types", payload);
            }
            invalidateCheckLogTypes();
            toast(type ? "Check type saved" : "Check type added");
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
      h("div", { class: "field" }, h("label", null, "Unit (optional)"), unit),
      h(
        "div",
        { class: "field" },
        h("label", null, "Fields"),
        h("div", { class: "row wrap" }, hasNumber.root, hasText.root, multiple.root),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Option buttons (optional)"),
        options,
        h(
          "span",
          { class: "dim small" },
          "Comma-separated. If set, these are shown as buttons instead of free text. Allow multiple lets you pick several.",
        ),
      ),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
