import type { LookupKind } from "../../../shared/lookups.ts";
import type { LookupDto } from "../../../shared/types.ts";
import { h } from "../dom.ts";
import { loadLookups } from "../lookups.ts";
import { openLookupModal } from "./lookupModal.ts";

export function lookupSelect(
  kind: LookupKind,
  options: {
    initialLabel?: string;
    emptyLabel?: string;
    onChange?: (lookup: LookupDto | null) => void;
  } = {},
): { root: HTMLSelectElement; value: () => string; setLabel: (label: string) => void } {
  let items: LookupDto[] = [];
  let current: LookupDto | null = null;
  let initialLabel = options.initialLabel ?? "";
  let selectedLabel = initialLabel;
  const emptyLabel = options.emptyLabel ?? "— None —";
  const select = h("select");
  select.disabled = true;

  const render = () => {
    const parts: Node[] = [h("option", { value: "" }, emptyLabel)];
    if (initialLabel && !items.some((item) => item.label === initialLabel)) {
      parts.push(h("option", { value: `label:${initialLabel}` }, `${initialLabel} (not in list)`));
    }
    for (const item of items) {
      parts.push(h("option", { value: String(item.id) }, item.label));
    }
    parts.push(h("option", { value: "__add__" }, "＋ Add new…"));
    select.replaceChildren(...parts);
    if (current) {
      select.value = String(current.id);
    } else if (selectedLabel && selectedLabel === initialLabel) {
      select.value = `label:${selectedLabel}`;
    } else {
      select.value = "";
    }
  };

  select.addEventListener("change", () => {
    const value = select.value;
    if (value === "__add__") {
      openLookupModal({
        kind,
        onSaved: (saved) => {
          items = [...items, saved];
          current = saved;
          selectedLabel = saved.label;
          render();
          options.onChange?.(saved);
        },
        onCancel: () => {
          select.value = current ? String(current.id) : selectedLabel ? `label:${selectedLabel}` : "";
        },
      });
      return;
    }
    if (value.startsWith("label:")) {
      current = null;
      selectedLabel = initialLabel;
      options.onChange?.(null);
      return;
    }
    current = items.find((item) => String(item.id) === value) ?? null;
    selectedLabel = current ? current.label : "";
    options.onChange?.(current);
  });

  void loadLookups()
    .then((all) => {
      items = all.filter((item) => item.kind === kind);
      select.disabled = false;
      render();
    })
    .catch(() => {
      select.disabled = false;
    });

  render();
  return {
    root: select,
    value: () => selectedLabel,
    setLabel: (label: string) => {
      initialLabel = label;
      selectedLabel = label;
      current = items.find((item) => item.label === label) ?? null;
      render();
    },
  };
}
