import type { VetDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { h } from "../dom.ts";
import { openVetModal } from "./vetModal.ts";

export function vetSelect(options: {
  initialName?: string;
  onChange?: (vet: VetDto | null) => void;
}): { root: HTMLElement; value: () => string } {
  let vets: VetDto[] = [];
  let current: VetDto | null = null;
  let selectedName = options.initialName ?? "";
  const select = h("select");
  select.disabled = true;
  const status = h("span", { class: "dim small" });

  const render = () => {
    const parts: Node[] = [h("option", { value: "" }, "— No vet selected —")];
    if (options.initialName && !vets.some((vet) => vet.name === options.initialName)) {
      parts.push(
        h("option", { value: `name:${options.initialName}` }, `${options.initialName} (not saved)`),
      );
    }
    for (const vet of vets) {
      parts.push(
        h(
          "option",
          { value: String(vet.id) },
          vet.clinic ? `${vet.name} — ${vet.clinic}` : vet.name,
        ),
      );
    }
    parts.push(h("option", { value: "__add__" }, "＋ Add a new vet…"));
    select.replaceChildren(...parts);
    if (current) {
      select.value = String(current.id);
    } else if (selectedName && selectedName === options.initialName) {
      select.value = `name:${selectedName}`;
    } else {
      select.value = "";
    }
  };

  select.addEventListener("change", () => {
    const value = select.value;
    if (value === "__add__") {
      openVetModal({
        onSaved: (vet) => {
          vets = [...vets, vet].sort((a, b) => a.name.localeCompare(b.name));
          current = vet;
          selectedName = vet.name;
          render();
          options.onChange?.(vet);
        },
        onCancel: () => {
          select.value = current ? String(current.id) : selectedName ? `name:${selectedName}` : "";
        },
      });
      return;
    }
    if (value.startsWith("name:")) {
      current = null;
      selectedName = options.initialName ?? "";
      options.onChange?.(null);
      return;
    }
    current = vets.find((vet) => String(vet.id) === value) ?? null;
    selectedName = current ? current.name : "";
    options.onChange?.(current);
  });

  void api
    .get<{ vets: VetDto[] }>("/api/vets")
    .then(({ vets: rows }) => {
      vets = rows;
      select.disabled = false;
      render();
    })
    .catch(() => {
      status.textContent = "Could not load the vet list.";
    });

  render();
  return {
    root: h("div", { class: "stack", style: { gap: "0.3rem" } }, select, status),
    value: () => selectedName,
  };
}
