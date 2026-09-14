import type { ClinicDto, VetDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openClinicModal } from "../components/clinicModal.ts";
import { confirmDialog } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import { openVetModal } from "../components/vetModal.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

export function renderVetsPage(_ctx: PageContext): HTMLElement {
  const vetList = h("div", { class: "stack" });
  const clinicList = h("div", { class: "stack" });
  const addVet = h(
    "button",
    {
      class: "btn primary small",
      type: "button",
      onClick: () => openVetModal({ onSaved: () => void load() }),
    },
    "Add vet",
  );
  const addClinic = h(
    "button",
    {
      class: "btn primary small",
      type: "button",
      onClick: () => openClinicModal({ onSaved: () => void load() }),
    },
    "Add clinic",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Vets & clinics"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
    ),
    h(
      "p",
      { class: "dim small" },
      "Save your vets and clinics once and pick them from the dropdowns when logging appointments and vaccinations.",
    ),
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Vets"),
      h("span", { class: "spacer" }),
      addVet,
    ),
    vetList,
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Clinics"),
      h("span", { class: "spacer" }),
      addClinic,
    ),
    clinicList,
  );

  async function load(): Promise<void> {
    const [{ vets }, { clinics }] = await Promise.all([
      api.get<{ vets: VetDto[] }>("/api/vets"),
      api.get<{ clinics: ClinicDto[] }>("/api/clinics"),
    ]);
    vetList.replaceChildren(
      ...(vets.length === 0
        ? [h("div", { class: "empty" }, "No vets saved yet.")]
        : vets.map(vetCard)),
    );
    clinicList.replaceChildren(
      ...(clinics.length === 0
        ? [h("div", { class: "empty" }, "No clinics saved yet.")]
        : clinics.map(clinicCard)),
    );
  }

  function vetCard(vet: VetDto): HTMLElement {
    const details = [vet.clinic, vet.phone, vet.email, vet.address].filter(Boolean).join(" · ");
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row wrap" },
        h("strong", null, vet.name),
        h("span", { class: "spacer" }),
        h(
          "button",
          {
            class: "btn outline small",
            type: "button",
            onClick: () => openVetModal({ vet, onSaved: () => void load() }),
          },
          "Edit",
        ),
        h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void removeVet(vet) },
          "Delete",
        ),
      ),
      details ? h("p", { class: "dim small", style: { margin: "0.3rem 0 0" } }, details) : null,
      vet.notes
        ? h("p", { style: { margin: "0.4rem 0 0", whiteSpace: "pre-wrap" } }, vet.notes)
        : null,
    );
  }

  function clinicCard(clinic: ClinicDto): HTMLElement {
    const details = [clinic.phone, clinic.email, clinic.address].filter(Boolean).join(" · ");
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row wrap" },
        h("strong", null, clinic.name),
        h("span", { class: "spacer" }),
        h(
          "button",
          {
            class: "btn outline small",
            type: "button",
            onClick: () => openClinicModal({ clinic, onSaved: () => void load() }),
          },
          "Edit",
        ),
        h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void removeClinic(clinic) },
          "Delete",
        ),
      ),
      details ? h("p", { class: "dim small", style: { margin: "0.3rem 0 0" } }, details) : null,
      clinic.notes
        ? h("p", { style: { margin: "0.4rem 0 0", whiteSpace: "pre-wrap" } }, clinic.notes)
        : null,
    );
  }

  async function removeVet(vet: VetDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete ${vet.name}?`,
      message: "Saved appointments and vaccinations keep the vet's name.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/vets/${vet.id}`);
    toast("Vet deleted");
    await load();
  }

  async function removeClinic(clinic: ClinicDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete ${clinic.name}?`,
      message: "Vets linked to it are kept but lose the clinic link.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/clinics/${clinic.id}`);
    toast("Clinic deleted");
    await load();
  }

  void load();
  return container;
}
