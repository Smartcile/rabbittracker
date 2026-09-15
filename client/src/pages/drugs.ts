import type { DrugBatchDto, DrugDto } from "../../../shared/types.ts";
import {
  formatDrugAmount,
  formatMgFromMicrograms,
  stockLevel,
  stockTotalMilliUnits,
} from "../../../shared/drugs.ts";
import { api } from "../api.ts";
import { openDrugModal } from "../components/drugModal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { fmtCalendarDate, h } from "../dom.ts";
import { can } from "../permissions.ts";

export function renderDrugsPage(ctx: PageContext): HTMLElement {
  const canEdit = can(ctx.user, "canRecordHealth");
  let drugs: DrugDto[] = [];
  let query = "";

  const list = h("div", { class: "grid-cards" });
  const summary = h("p", { class: "dim small" });
  const search = h("input", { type: "search", placeholder: "Search by name or ingredient" });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    renderList();
  });
  const add = h(
    "button",
    { class: "btn primary", onClick: () => openDrugModal({ onSaved: () => void load() }) },
    "Add drug",
  );
  const addDefaults = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: async () => {
        addDefaults.disabled = true;
        try {
          const { added } = await api.post<{ added: string[] }>("/api/drugs/defaults");
          if (added.length === 0) {
            toast("All starter drugs are already in the cabinet");
          } else {
            toast(`Added ${added.join(", ")}`);
            await load();
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : "Something went wrong", "error");
        } finally {
          addDefaults.disabled = false;
        }
      },
    },
    "Add defaults",
  );

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title", style: { flexWrap: "wrap" } },
      h("h1", null, "Drug cabinet"),
      h("span", { class: "spacer" }),
      canEdit ? addDefaults : null,
      canEdit ? add : null,
    ),
    h(
      "p",
      { class: "dim small", style: { margin: 0 } },
      "Starter doses and typical values are a reference only — always confirm with your vet.",
    ),
    h("div", { class: "field" }, h("label", null, "Search"), search),
    summary,
    list,
  );

  async function load(): Promise<void> {
    const response = await api.get<{ drugs: DrugDto[] }>("/api/drugs");
    drugs = response.drugs;
    renderList();
  }

  function renderList(): void {
    const filtered = query
      ? drugs.filter(
          (drug) =>
            drug.name.toLowerCase().includes(query) ||
            drug.activeIngredient.toLowerCase().includes(query),
        )
      : drugs;
    const reorderCount = drugs.filter(
      (drug) => stockLevel(stockTotalMilliUnits(drug.batches), drug.reorderLevelMilliUnits) !== "ok",
    ).length;
    summary.textContent =
      drugs.length === 0
        ? ""
        : `${drugs.length} drug${drugs.length === 1 ? "" : "s"}${
            reorderCount > 0 ? ` · ${reorderCount} need restocking` : " · all stocked"
          }`;
    if (filtered.length === 0) {
      list.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("strong", null, drugs.length === 0 ? "No drugs yet" : "No matches"),
          drugs.length === 0
            ? "Add a drug to start tracking stock and doses."
            : "Try another search.",
        ),
      );
      return;
    }
    list.replaceChildren(...filtered.map(card));
  }

  function card(drug: DrugDto): HTMLElement {
    const total = stockTotalMilliUnits(drug.batches);
    const level = stockLevel(total, drug.reorderLevelMilliUnits);
    const expiry = nearestExpiry(drug.batches);
    const expired = expiry !== null && expiry < todayKey();
    const badge =
      level === "ok"
        ? h("span", { class: "badge ok" }, "In stock")
        : level === "low"
          ? h("span", { class: "badge watch" }, "Low stock")
          : h("span", { class: "badge danger" }, "Out of stock");
    const element = h(
      "div",
      { class: `card drug-card${canEdit ? " clickable" : ""}` },
      h("div", { class: "row" }, h("strong", null, drug.name), h("span", { class: "spacer" }), badge),
      drug.activeIngredient ? h("span", { class: "dim small" }, drug.activeIngredient) : null,
      h("span", { class: "mono small" }, doseLine(drug)),
      h(
        "div",
        { class: "row wrap" },
        h("span", { class: "chip" }, formatDrugAmount(total, drug.unit)),
        expiry
          ? h(
              "span",
              { class: `chip${expired ? " down" : ""}` },
              expired ? `expired ${fmtCalendarDate(expiry)}` : `exp ${fmtCalendarDate(expiry)}`,
            )
          : null,
        drug.route ? h("span", { class: "dim small" }, drug.route) : null,
      ),
    );
    if (canEdit) {
      element.addEventListener("click", () =>
        openDrugModal({ drug, onSaved: () => void load(), onDeleted: () => void load() }),
      );
    }
    return element;
  }

  void load();
  return container;
}

function doseLine(drug: DrugDto): string {
  const parts: string[] = [];
  if (drug.doseMicrogramsPerKg !== null) {
    parts.push(`${formatMgFromMicrograms(drug.doseMicrogramsPerKg)} mg/kg`);
  }
  if (drug.concentrationMicrogramsPerUnit !== null) {
    parts.push(`${formatMgFromMicrograms(drug.concentrationMicrogramsPerUnit)} mg/${drug.unit}`);
  }
  if (drug.dosesPerDay > 1) parts.push(`${drug.dosesPerDay}× daily`);
  return parts.length > 0 ? parts.join(" · ") : "No structured dose";
}

function nearestExpiry(batches: DrugBatchDto[]): string | null {
  const dates = batches
    .map((batch) => batch.expiryDate)
    .filter((value): value is string => value !== null)
    .sort();
  return dates[0] ?? null;
}

function todayKey(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
