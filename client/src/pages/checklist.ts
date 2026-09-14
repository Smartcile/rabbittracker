import type { ChecklistOptionDto, ChecklistPhotoDto, ChecklistSectionDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { loadChecklist } from "../checklist.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import { toggleButton } from "../components/toggle.ts";
import type { ToggleHandle } from "../components/toggle.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

export function renderChecklistPage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack" });
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => addSection() },
    "Add section",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Health checklist"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Edit the sections, answers and example photos shown on every health check. Existing checks keep the answers they were saved with.",
    ),
    list,
  );

  async function reload(): Promise<void> {
    const sections = await loadChecklist(true);
    list.replaceChildren(...sections.map((section, index) => sectionCard(sections, section, index)));
  }

  function addSection(): void {
    const label = h("input", { placeholder: "e.g. Teeth" });
    const hint = h("input", { placeholder: "What to look for" });
    const multiple = toggleButton({ label: "Allows multiple answers" });
    const error = h("p", { class: "form-error" });
    error.style.display = "none";
    const save = h("button", { class: "btn primary", type: "submit" }, "Add section");
    const modal = openModal({
      title: "Add checklist section",
      body: h(
        "form",
        {
          onSubmit: async (event: Event) => {
            event.preventDefault();
            error.style.display = "none";
            save.disabled = true;
            try {
              await api.post("/api/checklist/sections", {
                label: label.value.trim(),
                hint: hint.value.trim(),
                multiple: multiple.checked(),
              });
              toast("Section added");
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
        h("div", { class: "field" }, h("label", null, "Label"), label),
        h("div", { class: "field" }, h("label", null, "What to look for"), hint),
        h("div", { class: "field" }, h("label", null, "Answer style"), multiple.root),
        h(
          "div",
          { class: "modal-actions" },
          h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
          save,
        ),
      ),
    });
  }

  function sectionCard(
    sections: ChecklistSectionDto[],
    section: ChecklistSectionDto,
    index: number,
  ): HTMLElement {
    const label = h("input", { value: section.label });
    const hint = h("textarea", null, section.hint);
    const multiple = toggleButton({ label: "Allows multiple answers", checked: section.multiple });
    const optionInputs = section.options.map((option) => ({
      option,
      input: h("input", { value: option.label }),
    }));

    const save = h("button", { class: "btn primary small", type: "button" }, "Save changes");
    save.addEventListener("click", () => void saveSection(section, label, hint, multiple, optionInputs, save));
    const remove = h(
      "button",
      { class: "btn ghost small", type: "button", onClick: () => void removeSection(section) },
      "Delete",
    );
    const up = h(
      "button",
      {
        class: "btn ghost small",
        type: "button",
        disabled: index === 0,
        onClick: () => void move(sections, index, -1),
      },
      "↑",
    );
    const down = h(
      "button",
      {
        class: "btn ghost small",
        type: "button",
        disabled: index === sections.length - 1,
        onClick: () => void move(sections, index, 1),
      },
      "↓",
    );

    const newOption = h("input", { placeholder: "New answer…" });
    const addOption = h(
      "button",
      { class: "btn outline small", type: "button", onClick: () => void createOption(section, newOption) },
      "Add answer",
    );

    const photoInput = h("input", { type: "file", accept: "image/*", class: "visually-hidden" });
    photoInput.addEventListener("change", () => void uploadPhoto(section, photoInput));
    const addPhoto = h(
      "button",
      { class: "btn outline small", type: "button", onClick: () => photoInput.click() },
      "Add photo",
    );

    return h(
      "div",
      { class: "card stack" },
      h(
        "div",
        { class: "row wrap" },
        up,
        down,
        h("strong", null, section.label),
        h("span", { class: "dim small" }, `${section.options.length} answers · ${section.photos.length} photos`),
        h("span", { class: "spacer" }),
        remove,
      ),
      h("div", { class: "field" }, h("label", null, "Label"), label),
      h("div", { class: "field" }, h("label", null, "What to look for"), hint),
      h("div", { class: "field" }, h("label", null, "Answer style"), multiple.root),
      h(
        "div",
        { class: "field" },
        h("label", null, "Answers"),
        h(
          "div",
          { class: "stack" },
          optionInputs.map(({ option, input }) =>
            h(
              "div",
              { class: "option-row" },
              h("span", { class: "mono small dim" }, option.value),
              input,
              h(
                "button",
                { class: "btn ghost small", type: "button", onClick: () => void removeOption(option) },
                "Remove",
              ),
            ),
          ),
        ),
        h("div", { class: "row" }, newOption, addOption),
      ),
      h(
        "div",
        { class: "field" },
        h("label", null, "Example photos"),
        section.photos.length === 0
          ? h("p", { class: "dim small" }, "No example photos yet.")
          : h(
              "div",
              { class: "photo-edit-grid" },
              section.photos.map((photo) => photoEditor(photo)),
            ),
        h("div", { class: "row" }, addPhoto, photoInput),
      ),
      h("div", { class: "row" }, save),
    );
  }

  function photoEditor(photo: ChecklistPhotoDto): HTMLElement {
    const caption = h("input", { value: photo.caption, placeholder: "Caption" });
    caption.addEventListener("change", () => void saveCaption(photo, caption));
    return h(
      "figure",
      { class: "photo-edit" },
      h("img", {
        src: `/api/photos/checklist/${photo.id}?size=thumb`,
        alt: photo.caption || "Example photo",
      }),
      caption,
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void removePhoto(photo) },
        "Remove",
      ),
    );
  }

  async function saveSection(
    section: ChecklistSectionDto,
    label: HTMLInputElement,
    hint: HTMLTextAreaElement,
    multiple: ToggleHandle,
    optionInputs: { option: ChecklistOptionDto; input: HTMLInputElement }[],
    save: HTMLButtonElement,
  ): Promise<void> {
    save.disabled = true;
    try {
      await api.patch(`/api/checklist/sections/${section.id}`, {
        label: label.value.trim(),
        hint: hint.value.trim(),
        multiple: multiple.checked(),
      });
      for (const { option, input } of optionInputs) {
        if (input.value.trim() !== option.label) {
          await api.patch(`/api/checklist/options/${option.id}`, { label: input.value.trim() });
        }
      }
      toast("Section saved");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      save.disabled = false;
    }
  }

  async function removeSection(section: ChecklistSectionDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${section.label}"?`,
      message: "The section, its answers and example photos are removed. Checks that used it keep their saved answers.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/checklist/sections/${section.id}`);
    toast("Section deleted");
    await reload();
  }

  async function move(
    sections: ChecklistSectionDto[],
    index: number,
    delta: number,
  ): Promise<void> {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const ids = sections.map((section) => section.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.put("/api/checklist/sections/reorder", { ids });
    await reload();
  }

  async function createOption(section: ChecklistSectionDto, input: HTMLInputElement): Promise<void> {
    const label = input.value.trim();
    if (!label) return;
    try {
      await api.post(`/api/checklist/sections/${section.id}/options`, { label });
      toast("Answer added");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function removeOption(option: ChecklistOptionDto): Promise<void> {
    await api.del(`/api/checklist/options/${option.id}`);
    toast("Answer removed");
    await reload();
  }

  async function saveCaption(photo: ChecklistPhotoDto, input: HTMLInputElement): Promise<void> {
    try {
      await api.patch(`/api/checklist/photos/${photo.id}`, { caption: input.value.trim() });
      toast("Caption saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function uploadPhoto(section: ChecklistSectionDto, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    try {
      await api.upload(`/api/checklist/sections/${section.id}/photos`, form);
      toast("Photo added");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      input.value = "";
    }
  }

  async function removePhoto(photo: ChecklistPhotoDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Remove example photo?",
      message: "This photo will no longer show on the checklist.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/checklist/photos/${photo.id}`);
    toast("Photo removed");
    await reload();
  }

  void reload();
  return container;
}
