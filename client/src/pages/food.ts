import type { FoodProductDto } from "../../../shared/types.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import { stockLevel } from "../../../shared/drugs.ts";
import { api } from "../api.ts";
import { openFoodModal } from "../components/foodModal.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";
import { can } from "../permissions.ts";

export function renderFoodPage(ctx: PageContext): HTMLElement {
  const canEdit = can(ctx.user, "canRecordHealth");
  let products: FoodProductDto[] = [];

  const list = h("div", { class: "grid-cards" });
  const summary = h("p", { class: "dim small" });
  const add = h(
    "button",
    { class: "btn primary", onClick: () => openFoodModal({ onSaved: () => void load() }) },
    "Add product",
  );

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Food & supplies"),
      h("span", { class: "spacer" }),
      canEdit ? add : null,
    ),
    h(
      "p",
      { class: "dim small", style: { margin: 0 } },
      "Track hay, pellets, treats and other supplies. Link a product to a bowl and topping up the bowl draws the amount from its stock.",
    ),
    summary,
    list,
  );

  async function load(): Promise<void> {
    const { products: rows } = await api.get<{ products: FoodProductDto[] }>("/api/food-products");
    products = rows;
    renderList();
  }

  function renderList(): void {
    const low = products.filter(
      (product) => stockLevel(product.stockGrams, product.reorderLevelGrams) !== "ok",
    ).length;
    summary.textContent =
      products.length === 0
        ? ""
        : `${products.length} product${products.length === 1 ? "" : "s"}${
            low > 0 ? ` · ${low} need restocking` : " · all stocked"
          }`;
    if (products.length === 0) {
      list.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("strong", null, "No products yet"),
          "Add hay, pellets or treats to track their stock.",
        ),
      );
      return;
    }
    list.replaceChildren(...products.map(card));
  }

  function card(product: FoodProductDto): HTMLElement {
    const level = stockLevel(product.stockGrams, product.reorderLevelGrams);
    const badge =
      level === "ok"
        ? h("span", { class: "badge ok" }, "In stock")
        : level === "low"
          ? h("span", { class: "badge watch" }, "Low stock")
          : h("span", { class: "badge danger" }, "Out of stock");
    const element = h(
      "div",
      { class: `card drug-card${canEdit ? " clickable" : ""}` },
      h("div", { class: "row" }, h("strong", null, product.name), h("span", { class: "spacer" }), badge),
      product.type ? h("span", { class: "dim small" }, product.type) : null,
      h(
        "div",
        { class: "row wrap" },
        h("span", { class: "chip" }, formatFoodAmount(product.stockGrams)),
        product.reorderLevelGrams > 0
          ? h("span", { class: "dim small" }, `low at ${formatFoodAmount(product.reorderLevelGrams)}`)
          : null,
      ),
    );
    if (canEdit) {
      element.addEventListener("click", () =>
        openFoodModal({ product, onSaved: () => void load(), onDeleted: () => void load() }),
      );
    }
    return element;
  }

  void load();
  return container;
}
