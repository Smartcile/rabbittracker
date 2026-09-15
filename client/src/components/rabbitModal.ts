import type { RabbitDto } from "../../../shared/types.ts";
import { parseWeightInput, weightInputValue } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { toggleButton } from "./toggle.ts";

export function openRabbitModal(options: {
  rabbit?: RabbitDto;
  onSaved: (rabbit: RabbitDto) => void;
}): void {
  const editing = options.rabbit;
  const name = h("input", { name: "name", required: true, value: editing?.name ?? "" });
  const sex = h(
    "select",
    { name: "sex" },
    h("option", { value: "unknown" }, "Unknown"),
    h("option", { value: "female" }, "Female"),
    h("option", { value: "male" }, "Male"),
  );
  sex.value = editing?.sex ?? "unknown";
  const breed = lookupSelect("breed", { initialLabel: editing?.breed ?? "" });
  const colour = lookupSelect("colour", { initialLabel: editing?.colour ?? "" });
  const dateOfBirth = h("input", { type: "date", name: "dateOfBirth", value: editing?.dateOfBirth ?? "" });
  const desexed = toggleButton({ label: "Desexed", checked: editing?.desexed ?? false });
  const microchip = h("input", { name: "microchip", value: editing?.microchip ?? "" });
  const status = h(
    "select",
    { name: "status" },
    h("option", { value: "active" }, "Active"),
    h("option", { value: "deceased" }, "Deceased"),
  );
  status.value = editing?.status ?? "active";
  const notes = h("textarea", { name: "notes" }, editing?.notes ?? "");
  const targetMin = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 2.2",
    value: weightInputValue(editing?.targetWeightMinGrams),
  });
  const targetMax = h("input", {
    inputmode: "decimal",
    placeholder: "e.g. 2.5",
    value: weightInputValue(editing?.targetWeightMaxGrams),
  });
  const feedingPlan = h("textarea", { name: "feedingPlan" }, editing?.feedingPlan ?? "");
  const quarantined = toggleButton({ label: "In quarantine", checked: editing?.quarantined ?? false });
  const quarantineUntil = h("input", { type: "date", value: editing?.quarantineUntil ?? "" });
  const quarantineField = h(
    "div",
    { class: "field" },
    h("label", null, "Quarantine until"),
    quarantineUntil,
  );
  const syncQuarantine = () => {
    quarantineField.style.display = quarantined.checked() ? "" : "none";
  };
  quarantined.root.addEventListener("click", syncQuarantine);
  syncQuarantine();
  const deceasedAt = h("input", { type: "date", value: editing?.deceasedAt ?? "" });
  const deceasedReason = h("input", { value: editing?.deceasedReason ?? "" });
  const memorialFields = h(
    "div",
    { class: "stack", style: { gap: "0.5rem" } },
    h("div", { class: "field" }, h("label", null, "Date of passing"), deceasedAt),
    h("div", { class: "field" }, h("label", null, "Reason / notes"), deceasedReason),
  );
  const syncMemorial = () => {
    memorialFields.style.display = status.value === "deceased" ? "" : "none";
  };
  status.addEventListener("change", syncMemorial);
  syncMemorial();
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save changes" : "Add bunny");

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.name}` : "Add a bunny",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          const payload: Record<string, unknown> = {
            name: name.value.trim(),
            sex: sex.value,
            breed: breed.value().trim(),
            colour: colour.value().trim(),
            dateOfBirth: dateOfBirth.value || null,
            desexed: desexed.checked(),
            microchip: microchip.value.trim(),
            notes: notes.value.trim(),
            status: status.value,
            targetWeightMinGrams: targetMin.value.trim() ? parseWeightInput(targetMin.value) : null,
            targetWeightMaxGrams: targetMax.value.trim() ? parseWeightInput(targetMax.value) : null,
            feedingPlan: feedingPlan.value.trim(),
            quarantined: quarantined.checked(),
            quarantineUntil: quarantined.checked() ? quarantineUntil.value || null : null,
          };
          if (status.value === "deceased") {
            payload.deceasedAt = deceasedAt.value || null;
            payload.deceasedReason = deceasedReason.value.trim();
          }
          try {
            const saved = editing
              ? await api.patch<{ rabbit: RabbitDto }>(`/api/rabbits/${editing.id}`, payload)
              : await api.post<{ rabbit: RabbitDto }>("/api/rabbits", payload);
            options.onSaved(saved.rabbit);
            toast(editing ? "Bunny updated" : "Bunny added");
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
      h("div", { class: "field" }, h("label", null, "Sex"), sex),
      h("div", { class: "field" }, h("label", null, "Breed"), breed.root),
      h("div", { class: "field" }, h("label", null, "Colour"), colour.root),
      h("div", { class: "field" }, h("label", null, "Date of birth"), dateOfBirth),
      h("div", { class: "field" }, h("label", null, "Desexed"), desexed.root),
      h("div", { class: "field" }, h("label", null, "Microchip"), microchip),
      h("div", { class: "field" }, h("label", null, "Status"), status),
      memorialFields,
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      h(
        "div",
        { class: "field" },
        h("label", null, "Target weight range"),
        h("div", { class: "row" }, targetMin, h("span", { class: "dim" }, "to"), targetMax),
        h("span", { class: "dim small" }, "Kilograms, e.g. 2.2 to 2.5. Leave blank for no target."),
      ),
      h("div", { class: "field" }, h("label", null, "Feeding plan"), feedingPlan),
      h("div", { class: "field" }, h("label", null, "Quarantine"), quarantined.root),
      quarantineField,
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
