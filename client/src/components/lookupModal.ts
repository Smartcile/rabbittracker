import type { LookupDto } from "../../../shared/types.ts";
import { LOOKUP_KIND_LABELS, lookupKindHasCost, lookupKindHasInterval } from "../../../shared/lookups.ts";
import type { LookupKind } from "../../../shared/lookups.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { invalidateLookups } from "../lookups.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openLookupModal(options: {
  kind: LookupKind;
  lookup?: LookupDto;
  onSaved: (lookup: LookupDto) => void;
  onCancel?: () => void;
}): void {
  const editing = options.lookup;
  const label = h("input", { required: true, value: editing?.label ?? "" });
  const interval = h("input", {
    type: "number",
    min: "1",
    max: "3650",
    value: editing?.defaultInt != null ? String(editing.defaultInt) : "",
  });
  const cost = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 85.00",
    value: editing?.defaultCents != null ? (editing.defaultCents / 100).toFixed(2) : "",
  });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save" : "Add");
  let saved = false;

  const fields: Node[] = [h("div", { class: "field" }, h("label", null, "Name"), label)];
  if (lookupKindHasInterval(options.kind)) {
    fields.push(
      h(
        "div",
        { class: "field" },
        h("label", null, "Default interval (days)"),
        interval,
        h("span", { class: "dim small" }, "Used to prefill the next due date."),
      ),
    );
  }
  if (lookupKindHasCost(options.kind)) {
    fields.push(
      h(
        "div",
        { class: "field" },
        h("label", null, "Default cost"),
        cost,
        h("span", { class: "dim small" }, "Used to prefill the appointment cost."),
      ),
    );
  }

  const modal = openModal({
    guardUnsaved: true,
    title: `${editing ? "Edit" : "Add to"} ${LOOKUP_KIND_LABELS[options.kind]}`,
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
          const costText = cost.value.trim();
          const payload: Record<string, unknown> = { label: label.value.trim() };
          if (lookupKindHasInterval(options.kind)) {
            payload.defaultInt = interval.value ? Number(interval.value) : null;
          }
          if (lookupKindHasCost(options.kind)) {
            payload.defaultCents = costText ? Math.round(Number(costText) * 100) : null;
          }
          try {
            const result = editing
              ? await api.patch<{ lookup: LookupDto }>(`/api/lookups/${editing.id}`, payload)
              : await api.post<{ lookup: LookupDto }>("/api/lookups", { ...payload, kind: options.kind });
            saved = true;
            invalidateLookups();
            options.onSaved(result.lookup);
            toast(editing ? "Saved" : "Added");
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
      ...fields,
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
