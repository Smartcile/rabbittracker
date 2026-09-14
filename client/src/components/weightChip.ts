import type { RabbitSummaryDto } from "../../../shared/types.ts";
import { formatWeight } from "../../../shared/health.ts";
import { h } from "../dom.ts";

export function weightSummaryLine(rabbit: RabbitSummaryDto): Node {
  if (rabbit.latestWeightGrams === null) {
    return h("span", { class: "dim small" }, "No weight yet");
  }
  const chip =
    rabbit.weightChangeGrams === null
      ? null
      : h(
          "span",
          { class: `chip ${rabbit.weightChangeGrams >= 0 ? "up" : "down"}` },
          `${rabbit.weightChangeGrams >= 0 ? "+" : "−"}${Math.abs(rabbit.weightChangeGrams)} g`,
        );
  return h(
    "span",
    { class: "row", style: { gap: "0.4rem" } },
    h("span", { class: "mono small" }, formatWeight(rabbit.latestWeightGrams)),
    chip,
  );
}

export function weightAlertBadge(rabbit: RabbitSummaryDto): Node | null {
  if (rabbit.weightAlert === "alert") return h("span", { class: "badge alert" }, "Weight alert");
  if (rabbit.weightAlert === "watch") return h("span", { class: "badge watch" }, "Weight watch");
  return null;
}
