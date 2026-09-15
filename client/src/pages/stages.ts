import type { GrowthStageDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openStageModal } from "../components/stageModal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

function ageRange(stage: GrowthStageDto): string {
  const months = (days: number) => {
    const value = days / 30;
    return value >= 12 ? `${Number((value / 12).toFixed(1))} yr` : `${Number(value.toFixed(1))} mo`;
  };
  return `${months(stage.startDays)} – ${stage.endDays >= 20_000 ? "onwards" : months(stage.endDays)}`;
}

export function renderStagesPage(_ctx: PageContext): HTMLElement {
  const list = h("div", { class: "stack", style: { gap: "0" } });
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => openStageModal({ onSaved: () => void load() }) },
    "Add stage",
  );
  const addDefaults = h(
    "button",
    { class: "btn ghost small", type: "button" },
    "Add defaults",
  );

  async function load(): Promise<void> {
    const { stages } = await api.get<{ stages: GrowthStageDto[] }>("/api/growth-stages");
    list.replaceChildren();
    if (stages.length === 0) {
      list.append(h("p", { class: "dim small", style: { margin: 0 } }, "No stages yet."));
      return;
    }
    for (const stage of stages) {
      list.append(
        h(
          "div",
          { class: "list-row" },
          h(
            "div",
            { class: "stack", style: { gap: "0.15rem" } },
            h("strong", null, stage.label),
            h(
              "span",
              { class: "dim small" },
              [ageRange(stage), stage.sex === "any" ? null : `${stage.sex} only`]
                .filter(Boolean)
                .join(" · "),
            ),
            stage.guidance ? h("span", { class: "dim small" }, stage.guidance) : null,
          ),
          h("span", { class: "spacer" }),
          h(
            "button",
            { class: "btn ghost small", type: "button", onClick: () => openStageModal({ stage, onSaved: () => void load(), onDeleted: () => void load() }) },
            "Edit",
          ),
        ),
      );
    }
  }

  addDefaults.addEventListener("click", async () => {
    try {
      const { added } = await api.post<{ added: string[] }>("/api/growth-stages/defaults");
      toast(added.length === 0 ? "All default stages are already set up" : `Added ${added.join(", ")}`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  });

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title", style: { flexWrap: "wrap" } },
      h("h1", null, "Growth stages"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
      addDefaults,
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Age-based care stages shown on each bunny's Growing up card. Ages are approximate — adjust them for your rabbits and your vet's advice.",
    ),
    list,
  );

  void load();
  return container;
}
