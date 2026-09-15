import type { FoodProductDto } from "../../../shared/types.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import { api } from "../api.ts";
import { fmtCalendarDate, h } from "../dom.ts";
import { lookupSelect } from "./lookupSelect.ts";
import { confirmDialog, openModal } from "./modal.ts";
import { toast } from "./toast.ts";

export function openFoodModal(options: {
  product?: FoodProductDto;
  onSaved: (product: FoodProductDto) => void;
  onDeleted?: () => void;
}): void {
  const editing = options.product;
  let current = editing ?? null;

  const name = h("input", { required: true, value: editing?.name ?? "" });
  const type = lookupSelect("food_type", {
    initialLabel: editing?.type ?? "",
    emptyLabel: "— No type —",
  });
  const reorder = h("input", {
    type: "number",
    min: "0",
    step: "1",
    placeholder: "0",
    value: editing && editing.reorderLevelGrams > 0 ? String(editing.reorderLevelGrams) : "",
  });
  const notes = h("textarea", null, editing?.notes ?? "");
  const amount = h("input", { inputmode: "decimal", placeholder: "e.g. 2000" });
  const entryNote = h("input", { placeholder: "Note (optional)" });
  const entries = h("div", { class: "stack", style: { gap: "0" } });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h(
    "button",
    { class: "btn primary", type: "submit" },
    editing ? "Save product" : "Add product",
  );

  function renderEntries(): void {
    entries.replaceChildren();
    if (!current || current.entries.length === 0) {
      entries.append(h("p", { class: "dim small", style: { margin: 0 } }, "No stock movements yet."));
      return;
    }
    for (const entry of current.entries) {
      entries.append(
        h(
          "div",
          { class: "list-row" },
          h(
            "span",
            {
              class: "mono",
              style: entry.amountGrams < 0 ? { color: "var(--warn)" } : undefined,
            },
            `${entry.amountGrams > 0 ? "+" : ""}${formatFoodAmount(entry.amountGrams)}`,
          ),
          h("span", { class: "dim small" }, entry.note || "—"),
          h("span", { class: "spacer" }),
          h("span", { class: "dim small" }, fmtCalendarDate(entry.createdAt)),
          h(
            "button",
            { class: "btn ghost small", type: "button", onClick: () => void removeEntry(entry.id) },
            "Remove",
          ),
        ),
      );
    }
  }

  async function addStock(sign: 1 | -1): Promise<void> {
    if (!current) return;
    const grams = Math.round(Number(amount.value.trim()));
    if (!Number.isFinite(grams) || grams <= 0) {
      toast("Enter a stock amount", "error");
      return;
    }
    try {
      const { product } = await api.post<{ product: FoodProductDto }>(
        `/api/food-products/${current.id}/entries`,
        { amountGrams: sign * grams, note: entryNote.value.trim() },
      );
      current = product;
      amount.value = "";
      entryNote.value = "";
      renderEntries();
      options.onSaved(current);
      toast(sign > 0 ? "Stock added" : "Stock removed");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update stock", "error");
    }
  }

  async function removeEntry(entryId: number): Promise<void> {
    if (!current) return;
    const confirmed = await confirmDialog({
      title: "Remove stock entry?",
      message: "The stock total is recalculated from the remaining entries.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const { product } = await api.del<{ product: FoodProductDto }>(
        `/api/food-products/entries/${entryId}`,
      );
      current = product;
      renderEntries();
      options.onSaved(current);
      toast("Stock entry removed");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove the entry", "error");
    }
  }

  async function removeProduct(): Promise<void> {
    if (!editing) return;
    const confirmed = await confirmDialog({
      title: `Delete ${editing.name}?`,
      message: "Its stock history is removed; bowls linked to it keep working without a product.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.del(`/api/food-products/${editing.id}`);
      options.onDeleted?.();
      toast("Product deleted");
      modal.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the product", "error");
    }
  }

  const modal = openModal({
    guardUnsaved: true,
    title: editing ? `Edit ${editing.name}` : "Add food product",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          const reorderGrams = reorder.value.trim() ? Math.round(Number(reorder.value)) : 0;
          if (!Number.isFinite(reorderGrams) || reorderGrams < 0) {
            error.textContent = "Enter a valid low-stock level.";
            error.style.display = "";
            return;
          }
          save.disabled = true;
          const payload = {
            name: name.value.trim(),
            type: type.value().trim(),
            reorderLevelGrams: reorderGrams,
            notes: notes.value.trim(),
          };
          try {
            let saved: FoodProductDto;
            if (editing) {
              saved = (
                await api.patch<{ product: FoodProductDto }>(
                  `/api/food-products/${editing.id}`,
                  payload,
                )
              ).product;
            } else {
              saved = (await api.post<{ product: FoodProductDto }>("/api/food-products", payload))
                .product;
            }
            current = saved;
            options.onSaved(saved);
            toast(editing ? "Product updated" : "Product added");
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
      h("div", { class: "field" }, h("label", null, "Type"), type.root),
      h(
        "div",
        { class: "field" },
        h("label", null, "Low-stock level (g)"),
        reorder,
        h("span", { class: "dim small" }, "Shows a low-stock badge at or below this amount. 0 turns it off."),
      ),
      h("div", { class: "field" }, h("label", null, "Notes"), notes),
      editing
        ? h(
            "div",
            { class: "card", style: { marginTop: "0.6rem" } },
            h(
              "div",
              { class: "card-title" },
              h("h2", null, "Stock"),
              h("span", { class: "spacer" }),
              h("span", { class: "mono small" }, formatFoodAmount(current?.stockGrams ?? 0)),
            ),
            entries,
            h("div", { class: "field" }, h("label", null, "Amount (g)"), amount),
            h("div", { class: "field" }, h("label", null, "Note (optional)"), entryNote),
            h(
              "div",
              { class: "row wrap" },
              h(
                "button",
                { class: "btn outline small", type: "button", onClick: () => void addStock(1) },
                "Add stock",
              ),
              h(
                "button",
                { class: "btn ghost small", type: "button", onClick: () => void addStock(-1) },
                "Remove stock",
              ),
            ),
          )
        : null,
      h(
        "div",
        { class: "modal-actions" },
        editing
          ? h("button", { class: "btn danger", type: "button", onClick: () => void removeProduct() }, "Delete")
          : null,
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });

  renderEntries();
}
