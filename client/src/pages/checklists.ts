import type {
  ChecklistDto,
  ChecklistItemDto,
  ChecklistSectionDto,
  CheckLogTypeDto,
} from "../../../shared/types.ts";
import { recurrenceLabel, type Recurrence } from "../../../shared/recurrence.ts";
import { api } from "../api.ts";
import { invalidateChecklist } from "../checklist.ts";
import { invalidateCheckLogTypes } from "../dailyLogs.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { recurrenceEditor } from "../components/recurrenceEditor.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

export function renderChecklistsPage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack" });
  let sections: ChecklistSectionDto[] = [];
  let types: CheckLogTypeDto[] = [];

  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => createChecklist() },
    "New checklist",
  );

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title", style: { flexWrap: "wrap" } },
      h("h1", null, "Checklists"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/checklist" }, "Edit questions"),
      h("a", { class: "btn outline small", href: "#/dailychecks" }, "Edit daily checks"),
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Group questions and daily checks into checklists. An item can live in several checklists — add a Daily check to the weekly checklist and it will show on the health check form.",
    ),
    list,
  );

  async function reload(): Promise<void> {
    const [checklistsRes, sectionsRes, typesRes] = await Promise.all([
      api.get<{ checklists: ChecklistDto[] }>("/api/checklists"),
      api.get<{ sections: ChecklistSectionDto[] }>("/api/checklist/sections"),
      api.get<{ types: CheckLogTypeDto[] }>("/api/check-logs/types/all"),
    ]);
    sections = sectionsRes.sections;
    types = typesRes.types;
    const itemLists = await Promise.all(
      checklistsRes.checklists.map((checklist) =>
        api.get<{ items: ChecklistItemDto[] }>(`/api/checklists/${checklist.id}/items`),
      ),
    );
    list.replaceChildren(
      ...checklistsRes.checklists.map((checklist, index) => card(checklist, itemLists[index]?.items ?? [])),
    );
  }

  function card(checklist: ChecklistDto, items: ChecklistItemDto[]): HTMLElement {
    const label = h("input", { value: checklist.label });
    const rename = h(
      "button",
      { class: "btn outline small", type: "button", onClick: () => void saveName(checklist, label) },
      "Rename",
    );
    const remove = checklist.isDaily
      ? h("span", { class: "badge accent" }, "Built-in")
      : h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void removeChecklist(checklist) },
          "Delete",
        );

    const rows = h("div", { class: "stack", style: { gap: "0" } });
    const renderRows = (current: ChecklistItemDto[]): void => {
      rows.replaceChildren(
        ...current.map((item, index) =>
          h(
            "div",
            { class: "list-row" },
            h(
              "span",
              { class: `badge ${item.kind === "type" ? "accent" : ""}` },
              item.kind === "type" ? "Daily" : "Question",
            ),
            h("strong", null, item.label),
            h("span", { class: "spacer" }),
            h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                disabled: index === 0,
                onClick: () => void moveItem(checklist, current, index, -1),
              },
              "↑",
            ),
            h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                disabled: index === current.length - 1,
                onClick: () => void moveItem(checklist, current, index, 1),
              },
              "↓",
            ),
            h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                onClick: () => void removeItem(checklist, item),
              },
              "Remove",
            ),
          ),
        ),
      );
    };
    renderRows(items);

    const select = h(
      "select",
      null,
      h("option", { value: "" }, "Add an item…"),
      h(
        "optgroup",
        { label: "Questions" },
        sections.map((section) => h("option", { value: `s:${section.id}` }, section.label)),
      ),
      h(
        "optgroup",
        { label: "Daily checks" },
        types.map((type) => h("option", { value: `t:${type.id}` }, type.label)),
      ),
    );
    select.addEventListener("change", () => {
      const value = select.value;
      if (!value) return;
      select.value = "";
      const [kind, id] = value.split(":");
      void addItem(checklist, kind === "t" ? { typeId: Number(id) } : { sectionId: Number(id) });
    });

    const recurrence = recurrenceEditor(checklist.recurrence);
    const schedule = checklist.isDaily
      ? null
      : h(
          "details",
          { class: "field" },
          h("summary", null, `Schedule: ${recurrenceLabel(checklist.recurrence)}`),
          recurrence.root,
          h(
            "div",
            { class: "row" },
            h(
              "button",
              {
                class: "btn outline small",
                type: "button",
                onClick: () => void saveSchedule(checklist, recurrence.value()),
              },
              "Save schedule",
            ),
          ),
        );

    return h(
      "div",
      { class: "card stack" },
      h(
        "div",
        { class: "row wrap" },
        label,
        rename,
        h("span", { class: "dim small" }, `${items.length} item${items.length === 1 ? "" : "s"}`),
        h("span", { class: "spacer" }),
        remove,
      ),
      schedule,
      items.length > 0
        ? rows
        : h("p", { class: "dim small", style: { margin: 0 } }, "No items yet."),
      h("div", { class: "row" }, select),
    );
  }

  async function saveSchedule(checklist: ChecklistDto, recurrence: Recurrence): Promise<void> {
    try {
      await api.patch(`/api/checklists/${checklist.id}`, { recurrence });
      invalidateChecklist();
      toast("Schedule saved");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function saveName(checklist: ChecklistDto, input: HTMLInputElement): Promise<void> {
    const label = input.value.trim();
    if (!label || label === checklist.label) return;
    try {
      await api.patch(`/api/checklists/${checklist.id}`, { label });
      toast("Checklist renamed");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function removeChecklist(checklist: ChecklistDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${checklist.label}"?`,
      message: "The checklist is removed. Its items stay in the library.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/checklists/${checklist.id}`);
    invalidateChecklist();
    toast("Checklist deleted");
    await reload();
  }

  async function addItem(
    checklist: ChecklistDto,
    body: { sectionId?: number; typeId?: number },
  ): Promise<void> {
    try {
      await api.post(`/api/checklists/${checklist.id}/items`, body);
      invalidateChecklist();
      invalidateCheckLogTypes();
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function removeItem(checklist: ChecklistDto, item: ChecklistItemDto): Promise<void> {
    await api.del(`/api/checklists/${checklist.id}/items/${item.id}`);
    invalidateChecklist();
    invalidateCheckLogTypes();
    await reload();
  }

  async function moveItem(
    checklist: ChecklistDto,
    items: ChecklistItemDto[],
    index: number,
    delta: number,
  ): Promise<void> {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.put(`/api/checklists/${checklist.id}/reorder`, { ids });
    await reload();
  }

  function createChecklist(): void {
    const label = h("input", { placeholder: "e.g. Post-op care" });
    const error = h("p", { class: "form-error" });
    error.style.display = "none";
    const save = h("button", { class: "btn primary", type: "submit" }, "Create");
    const modal = openModal({
      guardUnsaved: true,
      title: "New checklist",
      body: h(
        "form",
        {
          onSubmit: async (event: Event) => {
            event.preventDefault();
            error.style.display = "none";
            save.disabled = true;
            try {
              await api.post("/api/checklists", { label: label.value.trim() });
              toast("Checklist created");
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
        h(
          "div",
          { class: "modal-actions" },
          h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
          save,
        ),
      ),
    });
  }

  void reload();
  return container;
}
