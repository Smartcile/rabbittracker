import type { HealthCheckDto, RabbitDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { loadChecklist } from "../checklist.ts";
import { renderChecksTable } from "../components/checksTable.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";
import { can } from "../permissions.ts";

export function renderHistoryPage(ctx: PageContext): HTMLElement {
  const rabbitSelect = h("select", null, h("option", { value: "" }, "All bunnies"));
  const from = h("input", { type: "date" });
  const to = h("input", { type: "date" });
  const results = h("div");
  const rabbits: RabbitDto[] = [];

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  from.value = toDateInputValue(defaultFrom);
  to.value = toDateInputValue(new Date());

  async function refresh(): Promise<void> {
    const params = new URLSearchParams();
    if (rabbitSelect.value) params.set("rabbitId", rabbitSelect.value);
    if (from.value) params.set("from", new Date(`${from.value}T00:00:00`).toISOString());
    if (to.value) params.set("to", new Date(`${to.value}T23:59:59.999`).toISOString());
    const [{ checks }, sections] = await Promise.all([
      api.get<{ checks: HealthCheckDto[] }>(`/api/checks?${params.toString()}`),
      loadChecklist(),
    ]);
    if (checks.length === 0) {
      results.replaceChildren(h("div", { class: "empty" }, "No checks in this range."));
      return;
    }
    results.replaceChildren(
      renderChecksTable({
        checks,
        rabbits,
        sections,
        showRabbit: true,
        canEdit: can(ctx.user, "canRecordHealth"),
        onChanged: refresh,
      }),
    );
  }

  rabbitSelect.addEventListener("change", () => void refresh());
  from.addEventListener("change", () => void refresh());
  to.addEventListener("change", () => void refresh());

  const card = h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "filters" },
      h("div", { class: "field" }, h("label", null, "Bunny"), rabbitSelect),
      h("div", { class: "field" }, h("label", null, "From"), from),
      h("div", { class: "field" }, h("label", null, "To"), to),
    ),
    results,
  );

  void (async () => {
    const { rabbits: rows } = await api.get<{ rabbits: RabbitDto[] }>("/api/rabbits");
    rabbits.push(...rows);
    rabbitSelect.append(...rows.map((rabbit) => h("option", { value: String(rabbit.id) }, rabbit.name)));
    await refresh();
  })();

  return h("section", { class: "stack" }, h("h1", null, "History"), card);
}

function toDateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
