import { h } from "../dom.ts";

export function expandableList(
  rows: HTMLElement[],
  options: { initial?: number; moreLabel?: (count: number) => string } = {},
): HTMLElement {
  const initial = options.initial ?? 5;
  const container = h("div", { class: "stack", style: { gap: "0" } });
  const toggle = h("button", { class: "btn ghost small expand-toggle", type: "button" });
  let expanded = false;

  const render = (): void => {
    container.replaceChildren(...(expanded ? rows : rows.slice(0, initial)));
    toggle.textContent = expanded
      ? "Show less"
      : (options.moreLabel?.(rows.length) ?? `Show all (${rows.length})`);
    toggle.style.display = rows.length > initial ? "" : "none";
  };

  toggle.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });
  render();

  return h("div", { class: "stack", style: { gap: "0.3rem" } }, container, toggle);
}
