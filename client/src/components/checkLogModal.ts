import type { CheckLogDto, CheckLogTypeDto, RabbitDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { optionButtons } from "./toggle.ts";

export function openCheckLogModal(options: {
  rabbit: RabbitDto;
  types: CheckLogTypeDto[];
  log?: CheckLogDto;
  onSaved: () => void;
}): void {
  const editing = options.log;
  const typeSelect = h(
    "select",
    null,
    options.types.map((type) => h("option", { value: String(type.id) }, type.label)),
  );
  typeSelect.value = String(editing?.typeId ?? options.types[0]?.id ?? "");

  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(editing ? new Date(editing.loggedAt) : new Date());

  const fields = h("div", { class: "stack", style: { gap: "0.6rem" } });
  const numberInput = h("input", { inputmode: "decimal", placeholder: "e.g. 250" });
  const textInput = h("input", { placeholder: "Type / description" });
  let group: ReturnType<typeof optionButtons> | null = null;

  const renderFields = () => {
    const type = options.types.find((item) => String(item.id) === typeSelect.value);
    if (!type) {
      fields.replaceChildren();
      group = null;
      return;
    }
    const parts: Node[] = [];
    if (type.options.length > 0) {
      group = optionButtons(
        type.options.map((label) => ({ value: label, label })),
        editing && String(editing.typeId) === String(type.id) && editing.valueText
          ? [editing.valueText]
          : [],
        false,
      );
      parts.push(h("div", { class: "field" }, h("label", null, type.label), group.root));
    } else if (type.hasText) {
      parts.push(h("div", { class: "field" }, h("label", null, type.label), textInput));
    }
    if (type.hasNumber) {
      numberInput.value =
        editing && String(editing.typeId) === String(type.id) && editing.valueMilli != null
          ? String(Number((editing.valueMilli / 1000).toFixed(3)))
          : numberInput.value;
      parts.push(
        h(
          "div",
          { class: "field" },
          h("label", null, `Amount${type.unit ? ` (${type.unit})` : ""}`),
          numberInput,
        ),
      );
    }
    fields.replaceChildren(...parts);
  };

  typeSelect.addEventListener("change", () => {
    numberInput.value = "";
    textInput.value = "";
    renderFields();
  });
  renderFields();

  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save log" : "Save");

  const modal = openModal({
    title: editing ? "Edit daily check" : `Log daily check — ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const type = options.types.find((item) => String(item.id) === typeSelect.value);
          if (!type) {
            error.textContent = "Pick a check type.";
            error.style.display = "";
            return;
          }
          const loggedAt = new Date(when.value);
          if (Number.isNaN(loggedAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          const numberText = numberInput.value.trim();
          const valueMilli = type.hasNumber && numberText ? Math.round(Number(numberText) * 1000) : null;
          if (numberText && (valueMilli === null || !Number.isFinite(valueMilli) || valueMilli < 0)) {
            error.textContent = "Enter a valid amount.";
            error.style.display = "";
            return;
          }
          const valueText =
            type.options.length > 0 ? (group?.read()[0] ?? "") : type.hasText ? textInput.value.trim() : "";
          save.disabled = true;
          try {
            const payload = {
              loggedAt: loggedAt.toISOString(),
              valueMilli,
              valueText,
              notes: notes.value.trim(),
            };
            if (editing) {
              await api.patch(`/api/check-logs/${editing.id}`, payload);
            } else {
              await api.post("/api/check-logs", {
                ...payload,
                rabbitId: options.rabbit.id,
                typeId: type.id,
              });
            }
            toast(editing ? "Log updated" : "Logged");
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
      options.types.length > 0
        ? h("div", { class: "field" }, h("label", null, "Type"), typeSelect)
        : h("p", { class: "form-error" }, "No check types yet — add one in Settings → Daily checks."),
      h("div", { class: "field" }, h("label", null, "When"), when),
      fields,
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

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
