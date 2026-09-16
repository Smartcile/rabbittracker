import type { TaskDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openTaskCompleteModal(options: {
  task: TaskDto;
  date?: Date;
  onEdit?: () => void;
  onDone: () => void;
}): void {
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(defaultWhen(options.date));
  const notes = h("textarea");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Mark done");

  const modal = openModal({
    title: `Done — ${options.task.label}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const completedAt = new Date(when.value);
          if (Number.isNaN(completedAt.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          try {
            await api.post(`/api/tasks/${options.task.id}/complete`, {
              completedAt: completedAt.toISOString(),
              notes: notes.value.trim(),
            });
            toast("Done");
            options.onDone();
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
      h(
        "div",
        { class: "field" },
        h("label", null, "When was it done?"),
        when,
        h("span", { class: "dim small" }, "Change this to log a task you did earlier."),
      ),
      options.task.products.length > 0
        ? h(
            "p",
            { class: "dim small" },
            `Draws from stock: ${options.task.products
              .map(
                (product) =>
                  `${product.amountGrams > 0 ? `${product.amountGrams} g of ` : ""}${product.productName}`,
              )
              .join(", ")}.`,
          )
        : null,
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "modal-actions" },
        options.onEdit
          ? h(
              "button",
              {
                class: "btn ghost",
                type: "button",
                onClick: () => {
                  modal.close();
                  options.onEdit?.();
                },
              },
              "Edit task",
            )
          : null,
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

function defaultWhen(date: Date | undefined): Date {
  const now = new Date();
  if (!date) return now;
  if (localDayKey(date) === localDayKey(now)) return now;
  const base = new Date(date);
  base.setHours(12, 0, 0, 0);
  return base;
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
