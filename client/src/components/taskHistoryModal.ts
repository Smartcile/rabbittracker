import type { TaskCompletionDto, TaskDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openTaskHistoryModal(options: {
  task: TaskDto;
  completions: TaskCompletionDto[];
  onChanged: () => void;
}): void {
  const items = [...options.completions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const list = h("div", { class: "stack", style: { gap: "0" } });
  const empty = h("p", { class: "dim small", style: { margin: 0 } }, "No completions logged yet.");

  const render = (): void => {
    empty.style.display = items.length > 0 ? "none" : "";
    list.replaceChildren(...items.map(completionRow));
  };

  function completionRow(completion: TaskCompletionDto): HTMLElement {
    const when = h("input", { type: "datetime-local" });
    when.value = toLocalInputValue(new Date(completion.completedAt));
    const notes = h("input", { value: completion.notes, placeholder: "Notes" });
    const save = h("button", { class: "btn primary small", type: "button" }, "Save");
    save.addEventListener("click", () => void saveRow(completion, when, notes, save));
    const remove = h("button", { class: "btn ghost small", type: "button" }, "Delete");
    remove.addEventListener("click", () => void removeRow(completion));
    return h(
      "div",
      { class: "list-row" },
      h("span", { class: "badge ok" }, "Done"),
      h("div", { class: "stack", style: { gap: "0.25rem", flex: "1" } }, when, notes),
      h("span", { class: "spacer" }),
      save,
      remove,
    );
  }

  async function saveRow(
    completion: TaskCompletionDto,
    when: HTMLInputElement,
    notes: HTMLInputElement,
    save: HTMLButtonElement,
  ): Promise<void> {
    const completedAt = new Date(when.value);
    if (Number.isNaN(completedAt.getTime())) {
      toast("Pick a valid date and time", "error");
      return;
    }
    save.disabled = true;
    try {
      const { completion: updated } = await api.patch<{ completion: TaskCompletionDto }>(
        `/api/tasks/completions/${completion.id}`,
        { completedAt: completedAt.toISOString(), notes: notes.value.trim() },
      );
      const index = items.findIndex((item) => item.id === completion.id);
      if (index >= 0) items[index] = updated;
      items.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      render();
      toast("Saved");
      options.onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
      save.disabled = false;
    }
  }

  async function removeRow(completion: TaskCompletionDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Delete completion?",
      message: "The task becomes due again if this was its latest completion.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/tasks/completions/${completion.id}`);
      const index = items.findIndex((item) => item.id === completion.id);
      if (index >= 0) items.splice(index, 1);
      render();
      toast("Completion deleted");
      options.onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete", "error");
    }
  }

  render();

  openModal({
    title: `History — ${options.task.label}`,
    body: h(
      "div",
      null,
      h(
        "p",
        { class: "dim small" },
        "Every completion of this task. Change the date, time or notes and save.",
      ),
      empty,
      list,
    ),
  });
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
