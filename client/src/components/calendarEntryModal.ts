import type { CalendarEntryDto, RabbitDto } from "../../../shared/types.ts";
import { CALENDAR_REPEATS, CALENDAR_REPEAT_LABELS } from "../../../shared/calendar.ts";
import type { CalendarRepeat } from "../../../shared/calendar.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { toggleButton } from "./toggle.ts";

export function openCalendarEntryModal(options: {
  entry?: CalendarEntryDto;
  rabbits: RabbitDto[];
  onSaved: () => void;
}): void {
  const editing = options.entry;
  const start = editing ? new Date(editing.startAt) : new Date();
  const title = h("input", { required: true, value: editing?.title ?? "" });
  const type = lookupSelect("event_type", {
    initialLabel: editing?.type ?? "",
    emptyLabel: "— No type —",
  });
  const date = h("input", { type: "date", value: toDateValue(start) });
  const time = h("input", { type: "time", value: toTimeValue(start) });
  const allDay = toggleButton({ label: "All day", checked: editing?.allDay ?? false });
  const repeat = h(
    "select",
    null,
    CALENDAR_REPEATS.map((value) =>
      h("option", { value }, CALENDAR_REPEAT_LABELS[value as CalendarRepeat]),
    ),
  );
  repeat.value = editing?.repeat ?? "none";
  const repeatUntil = h("input", { type: "date", value: editing?.repeatUntil ?? "" });
  const repeatUntilField = h(
    "div",
    { class: "field" },
    h("label", null, "Repeat until"),
    repeatUntil,
  );
  const location = h("input", { value: editing?.location ?? "" });
  const rabbitSelect = h(
    "select",
    null,
    h("option", { value: "" }, "— Not linked to a bunny —"),
    options.rabbits.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)),
  );
  rabbitSelect.value = editing?.rabbitId != null ? String(editing.rabbitId) : "";
  const notes = h("textarea", null, editing?.notes ?? "");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save event" : "Add event");

  const syncFields = () => {
    time.style.display = allDay.checked() ? "none" : "";
    repeatUntilField.style.display = repeat.value === "none" ? "none" : "";
  };
  allDay.root.addEventListener("click", syncFields);
  repeat.addEventListener("change", syncFields);
  syncFields();

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.title}` : "Add calendar event",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const when = new Date(`${date.value}T${allDay.checked() ? "00:00" : time.value || "00:00"}`);
          if (Number.isNaN(when.getTime())) {
            error.textContent = "Pick a valid date.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          const payload = {
            title: title.value.trim(),
            type: type.value().trim() || "Other",
            startAt: when.toISOString(),
            allDay: allDay.checked(),
            location: location.value.trim(),
            notes: notes.value.trim(),
            rabbitId: rabbitSelect.value ? Number(rabbitSelect.value) : null,
            repeat: repeat.value,
            repeatUntil: repeat.value === "none" ? null : repeatUntil.value || null,
          };
          try {
            if (editing) {
              await api.patch(`/api/calendar-entries/${editing.id}`, payload);
            } else {
              await api.post("/api/calendar-entries", payload);
            }
            toast(editing ? "Event updated" : "Event added");
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
      h("div", { class: "field" }, h("label", null, "Title"), title),
      h("div", { class: "field" }, h("label", null, "Type"), type.root),
      h("div", { class: "field" }, h("label", null, "Date"), date),
      h("div", { class: "field" }, allDay.root),
      h("div", { class: "field" }, h("label", null, "Time"), time),
      h("div", { class: "field" }, h("label", null, "Repeats"), repeat),
      repeatUntilField,
      h("div", { class: "field" }, h("label", null, "Location"), location),
      h("div", { class: "field" }, h("label", null, "Bunny"), rabbitSelect),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "modal-actions" },
        editing
          ? h(
              "button",
              {
                class: "btn danger",
                type: "button",
                onClick: async () => {
                  const confirmed = await confirmDialog({
                    title: `Delete ${editing.title}?`,
                    message: "This removes the event from the calendar.",
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (!confirmed) return;
                  await api.del(`/api/calendar-entries/${editing.id}`);
                  toast("Event deleted");
                  options.onSaved();
                  modal.close();
                },
              },
              "Delete",
            )
          : null,
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

function toDateValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
