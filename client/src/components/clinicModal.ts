import type { ClinicDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openClinicModal(options: {
  clinic?: ClinicDto;
  onSaved: (clinic: ClinicDto) => void;
  onCancel?: () => void;
}): void {
  const editing = options.clinic;
  const name = h("input", { required: true, value: editing?.name ?? "" });
  const phone = h("input", { value: editing?.phone ?? "" });
  const email = h("input", { value: editing?.email ?? "" });
  const address = h("input", { value: editing?.address ?? "" });
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save clinic" : "Add clinic");
  let saved = false;

  const modal = openModal({
    title: editing ? `Edit ${editing.name}` : "Add a clinic",
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
            phone: phone.value.trim(),
            email: email.value.trim(),
            address: address.value.trim(),
            notes: notes.value.trim(),
          };
          try {
            const result = editing
              ? await api.patch<{ clinic: ClinicDto }>(`/api/clinics/${editing.id}`, payload)
              : await api.post<{ clinic: ClinicDto }>("/api/clinics", payload);
            saved = true;
            options.onSaved(result.clinic);
            toast(editing ? "Clinic updated" : "Clinic added");
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
