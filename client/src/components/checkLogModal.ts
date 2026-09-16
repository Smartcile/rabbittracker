import type { CheckLogDto, CheckLogPhotoDto, CheckLogTypeDto, RabbitDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lastLoggedLine } from "./lastLogged.ts";
import { openModal } from "./modal.ts";
import { openLightbox, photoPicker } from "./photoPicker.ts";
import { toast } from "./toast.ts";
import { optionButtons } from "./toggle.ts";

export function openCheckLogModal(options: {
  rabbit: RabbitDto;
  types: CheckLogTypeDto[];
  logs?: CheckLogDto[];
  log?: CheckLogDto;
  initialTypeId?: number;
  onSaved: () => void;
}): void {
  const editing = options.log;
  let selectedTypeId: number | null =
    editing?.typeId ?? options.initialTypeId ?? options.types[0]?.id ?? null;

  const when = h("input", { type: "datetime-local" });
  when.value = toLocalInputValue(editing ? new Date(editing.loggedAt) : new Date());

  const list = h("div", { class: "check-picker-list" });
  const panel = h("div", { class: "check-picker-panel" });
  const numberInput = h("input", { inputmode: "decimal", placeholder: "e.g. 250" });
  const textInput = h("input", { placeholder: "Type / description" });
  let group: ReturnType<typeof optionButtons> | null = null;

  const selectedType = (): CheckLogTypeDto | null =>
    options.types.find((type) => type.id === selectedTypeId) ?? null;

  const lastLoggedFor = (typeId: number): string | null => {
    const candidates = (options.logs ?? []).filter(
      (entry) => entry.typeId === typeId && entry.id !== editing?.id,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (a.loggedAt >= b.loggedAt ? a : b)).loggedAt;
  };

  const renderList = (): void => {
    list.replaceChildren(
      ...options.types.map((type) =>
        h(
          "button",
          {
            class: `check-picker-item${type.id === selectedTypeId ? " selected" : ""}`,
            type: "button",
            disabled: editing !== undefined && type.id !== editing.typeId,
            onClick: () => {
              if (type.id === selectedTypeId) return;
              selectedTypeId = type.id;
              numberInput.value = "";
              textInput.value = "";
              renderList();
              renderPanel();
            },
          },
          type.label,
        ),
      ),
    );
  };

  const renderPanel = (): void => {
    const type = selectedType();
    if (!type) {
      panel.replaceChildren();
      group = null;
      return;
    }
    const parts: Node[] = [];
    if (type.options.length > 0) {
      const selected =
        editing && editing.typeId === type.id
          ? editing.valueLabels.length > 0
            ? editing.valueLabels
            : editing.valueText
              ? [editing.valueText]
              : []
          : [];
      group = optionButtons(
        type.options.map((label) => ({ value: label, label })),
        selected,
        type.multiple,
      );
      parts.push(h("div", { class: "option-buttons" }, group.root));
    } else if (type.hasText) {
      parts.push(h("div", { class: "field" }, h("label", null, "Description"), textInput));
    }
    if (type.hasNumber) {
      numberInput.value =
        editing && editing.typeId === type.id && editing.valueMilli != null
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
    panel.replaceChildren(
      h("div", { class: "check-picker-heading" }, type.label),
      lastLoggedLine("Last logged", lastLoggedFor(type.id)),
      ...parts,
    );
  };

  renderList();
  renderPanel();

  const photos = editing ? [...editing.photos] : [];
  const photoList = h("div", { class: "check-photos" });
  const renderPhotos = () => {
    photoList.replaceChildren(
      ...photos.map((photo) => {
        const image = h("img", {
          class: "check-photo",
          src: `/api/photos/checklog/${photo.id}?size=thumb`,
          alt: photo.caption || "Check photo",
        });
        image.addEventListener("click", () =>
          openLightbox(`/api/photos/checklog/${photo.id}?size=full`, photo.caption || "Check photo"),
        );
        return h(
          "figure",
          { class: "check-photo-figure" },
          image,
          h(
            "button",
            {
              class: "btn ghost small",
              type: "button",
              onClick: () => void removePhoto(photo),
            },
            "Remove",
          ),
        );
      }),
    );
    photoList.style.display = photos.length > 0 ? "" : "none";
  };

  const removePhoto = async (photo: CheckLogPhotoDto): Promise<void> => {
    try {
      await api.del(`/api/check-logs/photos/${photo.id}`);
      const index = photos.findIndex((item) => item.id === photo.id);
      if (index >= 0) photos.splice(index, 1);
      renderPhotos();
      toast("Photo removed");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove photo", "error");
    }
  };
  renderPhotos();

  const picker = photoPicker({ label: "Add photo" });
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save log" : "Save");

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? "Edit daily check" : `Log daily check — ${options.rabbit.name}`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const type = selectedType();
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
          const valueLabels = type.options.length > 0 ? (group?.read() ?? []) : [];
          const valueText = type.options.length === 0 && type.hasText ? textInput.value.trim() : "";
          save.disabled = true;
          try {
            const payload = {
              loggedAt: loggedAt.toISOString(),
              valueMilli,
              valueLabels,
              valueText,
              notes: notes.value.trim(),
            };
            let logId = editing?.id;
            if (editing) {
              await api.patch(`/api/check-logs/${editing.id}`, payload);
            } else {
              const created = await api.post<{ log: CheckLogDto }>("/api/check-logs", {
                ...payload,
                rabbitId: options.rabbit.id,
                typeId: type.id,
              });
              logId = created.log.id;
            }
            const file = picker.file();
            if (file && logId != null) {
              const form = new FormData();
              form.append("photo", file);
              await api.upload(`/api/check-logs/${logId}/photos`, form);
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
        ? h(
            "div",
            { class: "field" },
            h("label", null, "Type"),
            h("div", { class: "check-picker" }, list, panel),
          )
        : h("p", { class: "form-error" }, "No check types yet — add one in Settings → Daily checks."),
      h("div", { class: "field" }, h("label", null, "When"), when),
      photoList,
      h("div", { class: "field" }, h("label", null, "Photo"), picker.root),
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
