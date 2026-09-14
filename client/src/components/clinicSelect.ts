import type { ClinicDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openClinicModal } from "./clinicModal.ts";

export function clinicSelect(options: {
  initialId?: number | null;
  onChange?: (clinic: ClinicDto | null) => void;
} = {}): { root: HTMLElement; value: () => number | null; name: () => string } {
  let clinics: ClinicDto[] = [];
  let current: ClinicDto | null = null;
  const select = h("select");
  select.disabled = true;
  const status = h("span", { class: "dim small" });

  const render = () => {
    const parts: Node[] = [h("option", { value: "" }, "— No clinic —")];
    for (const clinic of clinics) {
      parts.push(h("option", { value: String(clinic.id) }, clinic.name));
    }
    parts.push(h("option", { value: "__add__" }, "＋ Add a new clinic…"));
    select.replaceChildren(...parts);
    select.value = current ? String(current.id) : "";
  };

  select.addEventListener("change", () => {
    const value = select.value;
    if (value === "__add__") {
      openClinicModal({
        onSaved: (clinic) => {
          clinics = [...clinics, clinic].sort((a, b) => a.name.localeCompare(b.name));
          current = clinic;
          render();
          options.onChange?.(clinic);
        },
        onCancel: () => {
          select.value = current ? String(current.id) : "";
        },
      });
      return;
    }
    current = clinics.find((clinic) => String(clinic.id) === value) ?? null;
    options.onChange?.(current);
  });

  void api
    .get<{ clinics: ClinicDto[] }>("/api/clinics")
    .then(({ clinics: rows }) => {
      clinics = rows;
      if (options.initialId != null) {
        current = clinics.find((clinic) => clinic.id === options.initialId) ?? null;
      }
      select.disabled = false;
      render();
    })
    .catch(() => {
      status.textContent = "Could not load clinics.";
    });

  render();
  return {
    root: h("div", { class: "stack", style: { gap: "0.3rem" } }, select, status),
    value: () => current?.id ?? null,
    name: () => current?.name ?? "",
  };
}
