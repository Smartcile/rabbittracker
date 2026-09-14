import type { RabbitSex, RabbitSummaryDto } from "../../../shared/types.ts";
import { ageLabel } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
import { weightAlertBadge, weightSummaryLine } from "../components/weightChip.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";
import { can } from "../permissions.ts";

export function renderBunniesPage(ctx: PageContext): HTMLElement {
  const list = h("div", { class: "grid-cards" });
  const add = h(
    "button",
    { class: "btn primary", onClick: () => openRabbitModal({ onSaved: () => void load() }) },
    "Add bunny",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Bunnies"),
      h("span", { class: "spacer" }),
      can(ctx.user, "canCreateRabbits") ? add : null,
    ),
    list,
  );

  async function load(): Promise<void> {
    const { rabbits } = await api.get<{ rabbits: RabbitSummaryDto[] }>("/api/rabbits");
    if (rabbits.length === 0) {
      list.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("strong", null, "No bunnies yet"),
          "Add your first bunny to get started.",
        ),
      );
      return;
    }
    list.replaceChildren(...rabbits.map(card));
  }

  function card(rabbit: RabbitSummaryDto): HTMLElement {
    return h(
      "a",
      { class: "card rabbit-card", href: `#/rabbit/${rabbit.id}` },
      rabbitAvatar(rabbit, "lg"),
      h(
        "div",
        { class: "stack", style: { gap: "0.2rem" } },
        h("strong", null, rabbit.name),
        h("span", { class: "dim small" }, `${sexLabel(rabbit.sex)} · ${ageLabel(rabbit.dateOfBirth)}`),
        weightSummaryLine(rabbit),
        h(
          "div",
          { class: "row wrap" },
          weightAlertBadge(rabbit),
          rabbit.quarantined ? h("span", { class: "badge watch" }, "Quarantine") : null,
          rabbit.status === "deceased" ? h("span", { class: "badge" }, "Deceased") : null,
          rabbit.badges
            .filter((badge) => badge.kind !== "weight")
            .slice(0, 2)
            .map((badge) =>
              h(
                "span",
                { class: `badge ${badge.severity === "alert" ? "alert" : "watch"}` },
                badge.label,
              ),
            ),
        ),
      ),
    );
  }

  void load();
  return container;
}

export function sexLabel(sex: RabbitSex): string {
  return sex === "male" ? "Male" : sex === "female" ? "Female" : "Sex unknown";
}
