import type { TaskDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openTaskCompleteModal(options: { task: TaskDto; onDone: () => void }): void {
  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(new Date());
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
      options.task.productName
        ? h(
            "p",
            { class: "dim small" },
            `Draws ${
              options.task.amountGrams > 0 ? `${options.task.amountGrams} g of ` : ""
            }${options.task.productName} from stock.`,
          )
        : null,
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
