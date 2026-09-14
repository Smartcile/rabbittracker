import type { AppointmentDto, RabbitDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { vetSelect } from "./vetSelect.ts";

export type AppointmentPrefill = {
  title?: string;
  scheduledAt?: string | null;
  location?: string;
  eventUid?: string;
};

export function openAppointmentModal(options: {
  rabbits: RabbitDto[];
  rabbitId?: number;
  appointment?: AppointmentDto;
  prefill?: AppointmentPrefill;
  showCost?: boolean;
  onSaved: (appointment: AppointmentDto) => void;
}): void {
  const editing = options.appointment;
  const prefill = options.prefill ?? {};
  const showCost = options.showCost ?? true;
  const rabbitSelect = h(
    "select",
    { name: "rabbitId" },
    options.rabbits.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)),
  );
  rabbitSelect.value = String(editing?.rabbitId ?? options.rabbitId ?? options.rabbits[0]?.id ?? "");

  const title = h("input", {
    name: "title",
    required: true,
    value: editing?.title ?? prefill.title ?? "",
  });
  const clinic = h("input", { name: "clinic", value: editing?.clinic ?? "" });
  const vet = vetSelect({
    initialName: editing?.vet ?? "",
    onChange: (selected) => {
      if (selected?.clinic && !clinic.value.trim()) clinic.value = selected.clinic;
    },
  });
  const location = lookupSelect("location", {
    initialLabel: editing?.location ?? prefill.location ?? "",
    emptyLabel: "— No location —",
  });
  const scheduledAt = h("input", { type: "datetime-local", name: "scheduledAt", required: true });
  const scheduledSource = editing?.scheduledAt ?? prefill.scheduledAt;
  scheduledAt.value = toLocalInputValue(scheduledSource ? new Date(scheduledSource) : new Date());
  const status = h(
    "select",
    { name: "status" },
    h("option", { value: "scheduled" }, "Scheduled"),
    h("option", { value: "completed" }, "Completed"),
    h("option", { value: "cancelled" }, "Cancelled"),
  );
  status.value = editing?.status ?? "scheduled";
  const cost = h("input", {
    name: "cost",
    inputmode: "decimal",
    placeholder: "e.g. 125.00",
    value: editing?.costCents != null ? (editing.costCents / 100).toFixed(2) : "",
  });
  const followUpAt = h("input", { type: "datetime-local", name: "followUpAt" });
  followUpAt.value = editing?.followUpAt ? toLocalInputValue(new Date(editing.followUpAt)) : "";
  const notes = h("textarea", { name: "notes" }, editing?.notes ?? "");
  const visitType = lookupSelect("visit_type", {
    emptyLabel: "— No type —",
    onChange: (lookup) => {
      if (!lookup) return;
      title.value = lookup.label;
      if (showCost && lookup.defaultCents != null) {
        cost.value = (lookup.defaultCents / 100).toFixed(2);
      }
    },
  });

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h(
    "button",
    { class: "btn primary", type: "submit" },
    editing ? "Save appointment" : "Add appointment",
  );

  const modal = openModal({
    title: editing ? `Edit ${editing.title}` : "Add appointment",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const costText = cost.value.trim();
          const costCents = costText ? Math.round(Number(costText) * 100) : null;
          if (showCost && costText && (!Number.isFinite(Number(costText)) || Number(costText) < 0)) {
            error.textContent = "Enter a cost like 125.00.";
            error.style.display = "";
            return;
          }
          const when = new Date(scheduledAt.value);
          if (Number.isNaN(when.getTime())) {
            error.textContent = "Pick a valid date and time.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          const payload: Record<string, unknown> = {
            title: title.value.trim(),
            clinic: clinic.value.trim(),
            vet: vet.value().trim(),
            location: location.value().trim(),
            scheduledAt: when.toISOString(),
            status: status.value,
            followUpAt: followUpAt.value ? new Date(followUpAt.value).toISOString() : null,
            eventUid: editing?.eventUid ?? prefill.eventUid ?? null,
            notes: notes.value.trim(),
          };
          if (showCost) payload.costCents = costCents;
          try {
            const saved = editing
              ? await api.patch<{ appointment: AppointmentDto }>(
                  `/api/appointments/${editing.id}`,
                  payload,
                )
              : await api.post<{ appointment: AppointmentDto }>("/api/appointments", {
                  ...payload,
                  rabbitId: Number(rabbitSelect.value),
                });
            options.onSaved(saved.appointment);
            toast(editing ? "Appointment updated" : "Appointment added");
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
      h("div", { class: "field" }, h("label", null, "Bunny"), rabbitSelect),
      h("div", { class: "field" }, h("label", null, "Type"), visitType.root),
      h("div", { class: "field" }, h("label", null, "Title"), title),
      h("div", { class: "field" }, h("label", null, "When"), scheduledAt),
      h("div", { class: "field" }, h("label", null, "Vet"), vet.root),
      h("div", { class: "field" }, h("label", null, "Clinic"), clinic),
      h("div", { class: "field" }, h("label", null, "Location"), location.root),
      h("div", { class: "field" }, h("label", null, "Status"), status),
      showCost ? h("div", { class: "field" }, h("label", null, "Cost"), cost) : null,
      h("div", { class: "field" }, h("label", null, "Follow-up"), followUpAt),
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
