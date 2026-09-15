import type { VetDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { clinicSelect } from "./clinicSelect.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openVetModal(options: {
  vet?: VetDto;
  onSaved: (vet: VetDto) => void;
  onCancel?: () => void;
}): void {
  const editing = options.vet;
  const name = h("input", { required: true, value: editing?.name ?? "" });
  const clinic = clinicSelect({ initialId: editing?.clinicId ?? null });
  const phone = h("input", { value: editing?.phone ?? "" });
  const email = h("input", { value: editing?.email ?? "" });
  const address = h("input", { value: editing?.address ?? "" });
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save vet" : "Add vet");
  let saved = false;

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.name}` : "Add a vet",
    onClose: () => {
      if (!saved) options.onCancel?.();
    },
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          const payload = {
            name: name.value.trim(),
            clinicId: clinic.value(),
            phone: phone.value.trim(),
            email: email.value.trim(),
            address: address.value.trim(),
            notes: notes.value.trim(),
          };
          try {
            const result = editing
              ? await api.patch<{ vet: VetDto }>(`/api/vets/${editing.id}`, payload)
              : await api.post<{ vet: VetDto }>("/api/vets", payload);
            saved = true;
            options.onSaved(result.vet);
            toast(editing ? "Vet updated" : "Vet added");
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
      h("div", { class: "field" }, h("label", null, "Name"), name),
      h("div", { class: "field" }, h("label", null, "Clinic / practice"), clinic.root),
      h("div", { class: "field" }, h("label", null, "Phone"), phone),
      h("div", { class: "field" }, h("label", null, "Email"), email),
      h("div", { class: "field" }, h("label", null, "Address"), address),
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
