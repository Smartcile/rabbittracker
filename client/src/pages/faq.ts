import type { FaqEntryDto, FaqGroupDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { lookupSelect } from "../components/lookupSelect.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";
import { can } from "../permissions.ts";

export function renderFaqPage(ctx: PageContext): HTMLElement {
  const canEditFaq = can(ctx.user, "canEditFaq");
  let editMode = false;
  let groups: FaqGroupDto[] = [];
  const content = h("div", { class: "stack" });

  const toggle = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () => {
        editMode = !editMode;
        toggle.textContent = editMode ? "Done editing" : "Edit";
        render();
      },
    },
    "Edit",
  );
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => openFaqModal(categories(), () => void load()) },
    "Add entry",
  );

  async function load(): Promise<void> {
    const result = await api.get<{ groups: FaqGroupDto[] }>("/api/faq");
    groups = result.groups;
    render();
  }

  function categories(): string[] {
    return groups.map((group) => group.category);
  }

  function render(): void {
    if (groups.length === 0) {
      content.replaceChildren(h("div", { class: "empty" }, "No FAQ entries yet."));
      return;
    }
    content.replaceChildren(
      ...groups.map((group) =>
        h(
          "div",
          { class: "card" },
          h("h2", null, group.category),
          ...group.entries.map((entry, index) =>
            canEditFaq && editMode
              ? editRow(entry, group, index, () => void load())
              : accordionItem(entry),
          ),
        ),
      ),
    );
  }

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Rabbit care FAQ"),
      h("span", { class: "spacer" }),
      canEditFaq ? add : null,
      canEditFaq ? toggle : null,
    ),
    content,
  );

  void load();
  return container;
}

function accordionItem(entry: FaqEntryDto): HTMLElement {
  const answer = h("p", { class: "faq-answer" }, entry.answer);
  answer.style.display = "none";
  return h(
    "div",
    { class: "faq-item" },
    h(
      "button",
      {
        class: "faq-question",
        type: "button",
        onClick: () => {
          answer.style.display = answer.style.display === "none" ? "" : "none";
        },
      },
      entry.question,
    ),
    answer,
  );
}

function editRow(
  entry: FaqEntryDto,
  group: FaqGroupDto,
  index: number,
  reload: () => void,
): HTMLElement {
  const category = h("input", { value: entry.category });
  const question = h("input", { value: entry.question });
  const answer = h("textarea", null, entry.answer);
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary small", type: "button", onClick: () => void runSave() }, "Save");
  const remove = h("button", { class: "btn danger small", type: "button", onClick: () => void runDelete() }, "Delete");
  const up = h(
    "button",
    {
      class: "btn ghost small",
      type: "button",
      disabled: index === 0,
      onClick: () => void move(group, index, -1, reload),
    },
    "↑",
  );
  const down = h(
    "button",
    {
      class: "btn ghost small",
      type: "button",
      disabled: index === group.entries.length - 1,
      onClick: () => void move(group, index, 1, reload),
    },
    "↓",
  );

  async function runSave(): Promise<void> {
    error.style.display = "none";
    save.disabled = true;
    try {
      await api.patch(`/api/faq/${entry.id}`, {
        category: category.value,
        question: question.value,
        answer: answer.value,
      });
      toast("FAQ entry saved");
      reload();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    } finally {
      save.disabled = false;
    }
  }

  async function runDelete(): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Delete entry?",
      message: "This removes the FAQ entry.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/faq/${entry.id}`);
    toast("FAQ entry deleted");
    reload();
  }

  return h(
    "div",
    { class: "faq-edit" },
    error,
    h("div", { class: "field" }, h("label", null, "Category"), category),
    h("div", { class: "field" }, h("label", null, "Question"), question),
    h("div", { class: "field" }, h("label", null, "Answer"), answer),
    h("div", { class: "row wrap" }, save, remove, h("span", { class: "spacer" }), up, down),
  );
}

async function move(
  group: FaqGroupDto,
  index: number,
  delta: number,
  reload: () => void,
): Promise<void> {
  const target = index + delta;
  if (target < 0 || target >= group.entries.length) return;
  const ids = group.entries.map((entry) => entry.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await api.put("/api/faq/reorder", { ids });
  reload();
}

function openFaqModal(categories: string[], onSaved: () => void): void {
  const category = lookupSelect("faq_category", { initialLabel: categories[0] ?? "" });
  const question = h("input", { required: true });
  const answer = h("textarea", { required: true });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Add entry");

    const modal = openModal({
      guardUnsaved: true,
    title: "Add FAQ entry",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          try {
            await api.post("/api/faq", {
              category: category.value().trim(),
              question: question.value,
              answer: answer.value,
            });
            toast("FAQ entry added");
            onSaved();
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
      h("div", { class: "field" }, h("label", null, "Category"), category.root),
      h("div", { class: "field" }, h("label", null, "Question"), question),
      h("div", { class: "field" }, h("label", null, "Answer"), answer),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
