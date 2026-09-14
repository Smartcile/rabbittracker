import type { RabbitDto, VaccinationDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { openModal } from "./modal.ts";
import { toast } from "./toast.ts";
import { vetSelect } from "./vetSelect.ts";

export function openVaccinationModal(options: {
  rabbits: RabbitDto[];
  rabbitId?: number;
  vaccination?: VaccinationDto;
  onSaved: (vaccination: VaccinationDto) => void;
}): void {
  const editing = options.vaccination;
  const rabbitSelect = h(
    "select",
    { name: "rabbitId" },
    options.rabbits.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)),
  );
  rabbitSelect.value = String(editing?.rabbitId ?? options.rabbitId ?? options.rabbits[0]?.id ?? "");
  rabbitSelect.disabled = Boolean(editing);

  const givenAt = h("input", { type: "date", name: "givenAt", required: true, value: editing?.givenAt ?? "" });
  const nextDueAt = h("input", { type: "date", name: "nextDueAt", value: editing?.nextDueAt ?? "" });
  let defaultInterval: number | null = null;
  const applyDefaultDue = () => {
    if (!defaultInterval || nextDueAt.value || !givenAt.value) return;
    const date = new Date(`${givenAt.value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + defaultInterval);
    nextDueAt.value = date.toISOString().slice(0, 10);
  };
  const vaccine = lookupSelect("vaccine_type", {
    initialLabel: editing?.vaccine ?? "",
    emptyLabel: "— Select vaccine —",
    onChange: (lookup) => {
      defaultInterval = lookup?.defaultInt ?? null;
      applyDefaultDue();
    },
  });
  givenAt.addEventListener("change", applyDefaultDue);
  const vet = vetSelect({ initialName: editing?.vet ?? "" });
  const batch = h("input", { name: "batch", value: editing?.batch ?? "" });
  const notes = h("textarea", { name: "notes" }, editing?.notes ?? "");

  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save vaccination" : "Add vaccination");

  const modal = openModal({
    title: editing ? `Edit ${editing.vaccine}` : "Add vaccination",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          const payload = {
            vaccine: vaccine.value().trim(),
            givenAt: givenAt.value,
            nextDueAt: nextDueAt.value || null,
            vet: vet.value().trim(),
            batch: batch.value.trim(),
            notes: notes.value.trim(),
          };
          try {
            const saved = editing
              ? await api.patch<{ vaccination: VaccinationDto }>(
                  `/api/vaccinations/${editing.id}`,
                  payload,
                )
              : await api.post<{ vaccination: VaccinationDto }>("/api/vaccinations", {
                  ...payload,
                  rabbitId: Number(rabbitSelect.value),
                });
            options.onSaved(saved.vaccination);
            toast(editing ? "Vaccination updated" : "Vaccination added");
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
      h("div", { class: "field" }, h("label", null, "Vaccine"), vaccine.root),
      h("div", { class: "field" }, h("label", null, "Given on"), givenAt),
      h("div", { class: "field" }, h("label", null, "Next due"), nextDueAt),
      h("div", { class: "field" }, h("label", null, "Vet"), vet.root),
      h("div", { class: "field" }, h("label", null, "Batch"), batch),
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
