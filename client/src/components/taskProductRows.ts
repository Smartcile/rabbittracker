import type { FoodProductDto, TaskProductInput } from "../../../shared/types.ts";
import { h } from "../dom.ts";

export type TaskProductRowList = {
  root: HTMLElement;
  add: () => void;
  setProducts: (products: FoodProductDto[]) => void;
  setValues: (values: TaskProductInput[]) => void;
  collect: () => TaskProductInput[] | null;
};

type ProductRow = {
  root: HTMLElement;
  select: HTMLSelectElement;
  amount: HTMLInputElement;
  productId: number | null;
};

export function taskProductRows(initial: TaskProductInput[] = []): TaskProductRowList {
  let products: FoodProductDto[] = [];
  const rows: ProductRow[] = [];
  const list = h("div", { class: "stack", style: { gap: "0.5rem" } });

  const optionsFor = (): HTMLElement[] => [
    h("option", { value: "" }, "— Choose product —"),
    ...products.map((product) => h("option", { value: String(product.id) }, product.name)),
  ];

  const add = (productId: number | null, amountGrams: number): void => {
    const select = h("select", null, ...optionsFor());
    const amount = h("input", {
      inputmode: "decimal",
      placeholder: "e.g. 500",
      value: amountGrams > 0 ? String(amountGrams) : "",
    });
    const row: ProductRow = { root: null as unknown as HTMLElement, select, amount, productId };
    select.value = productId !== null ? String(productId) : "";
    select.addEventListener("change", () => {
      row.productId = select.value ? Number(select.value) : null;
    });
    const root = h(
      "div",
      { class: "row", style: { gap: "0.4rem", alignItems: "flex-end" } },
      h(
        "div",
        { class: "field", style: { flex: "1", margin: 0 } },
        h("label", null, "Product"),
        select,
      ),
      h(
        "div",
        { class: "field", style: { width: "7.5rem", margin: 0 } },
        h("label", null, "Amount (g)"),
        amount,
      ),
      h(
        "button",
        {
          class: "btn ghost small",
          type: "button",
          onClick: () => {
            const index = rows.findIndex((item) => item.root === root);
            if (index >= 0) rows.splice(index, 1);
            root.remove();
          },
        },
        "Remove",
      ),
    );
    row.root = root;
    rows.push(row);
    list.append(root);
  };

  const setValues = (values: TaskProductInput[]): void => {
    list.replaceChildren();
    rows.length = 0;
    for (const value of values) add(value.productId, value.amountGrams);
  };

  setValues(initial);

  return {
    root: list,
    add: () => add(null, 0),
    setProducts: (next) => {
      products = next;
      for (const row of rows) {
        row.select.replaceChildren(...optionsFor());
        row.select.value = row.productId !== null ? String(row.productId) : "";
      }
    },
    setValues,
    collect: () => {
      const out: TaskProductInput[] = [];
      for (const row of rows) {
        if (!row.select.value) continue;
        const text = row.amount.value.trim();
        const grams = text ? Math.round(Number(text)) : 0;
        if (!Number.isFinite(grams) || grams < 0) return null;
        out.push({ productId: Number(row.select.value), amountGrams: grams });
      }
      return out;
    },
  };
}
