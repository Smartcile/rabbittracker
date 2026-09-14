import { LOOKUP_KINDS, LOOKUP_KIND_LABELS } from "../../../shared/lookups.ts";
import type { LookupKind } from "../../../shared/lookups.ts";
import type { LookupDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openLookupModal } from "../components/lookupModal.ts";
import { confirmDialog } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";
import { invalidateLookups, loadLookups } from "../lookups.ts";

export function renderLookupsPage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack" });
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Lists"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
    ),
    h(
      "p",
      { class: "dim small" },
      "Reusable options for the dropdowns across the app. Add a value here or straight from any dropdown.",
    ),
    list,
  );

  async function reload(): Promise<void> {
    const all = await loadLookups(true);
    list.replaceChildren(
      ...LOOKUP_KINDS.map((kind) =>
        card(
          kind,
          all.filter((lookup) => lookup.kind === kind),
        ),
      ),
    );
  }

  function card(kind: LookupKind, items: LookupDto[]): HTMLElement {
    const add = h(
      "button",
      {
        class: "btn primary small",
        type: "button",
        onClick: () => openLookupModal({ kind, onSaved: () => void reload() }),
      },
      "Add",
    );
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "card-title" },
        h("h2", null, LOOKUP_KIND_LABELS[kind]),
        h("span", { class: "spacer" }),
        add,
      ),
      items.length === 0
        ? h("p", { class: "dim small", style: { marginBottom: 0 } }, "No entries yet.")
        : h(
            "div",
            null,
            items.map((lookup) => row(lookup)),
          ),
    );
  }

  function row(lookup: LookupDto): HTMLElement {
    const detail =
      lookup.defaultInt != null
        ? `${lookup.defaultInt} days`
        : lookup.defaultCents != null
          ? `$${(lookup.defaultCents / 100).toFixed(2)}`
          : "";
    return h(
      "div",
      { class: "list-row" },
      h("span", null, lookup.label),
      detail ? h("span", { class: "dim small" }, detail) : null,
      h("span", { class: "spacer" }),
      h(
        "button",
        {
          class: "btn ghost small",
          type: "button",
          onClick: () =>
            openLookupModal({ kind: lookup.kind as LookupKind, lookup, onSaved: () => void reload() }),
        },
        "Edit",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void remove(lookup) },
        "Delete",
      ),
    );
  }

  async function remove(lookup: LookupDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${lookup.label}"?`,
      message: "Records that already use it keep their saved value.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/lookups/${lookup.id}`);
    invalidateLookups();
    toast("Removed");
    await reload();
  }

  void reload();
  return container;
}
