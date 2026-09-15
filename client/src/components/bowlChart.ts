import type { BowlDto } from "../../../shared/types.ts";
import { summarizeBowlByDay } from "../../../shared/bowls.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import { h } from "../dom.ts";

const WIDTH = 640;
const HEIGHT = 240;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 26;
const PAD_BOTTOM = 40;
const WINDOW_DAYS = 14;
const SERIES_COUNT = 5;

type BowlSeries = {
  label: string;
  color: number;
  values: (number | null)[];
  average: number;
};

export function renderBowlsChart(bowls: BowlDto[], windowDays = WINDOW_DAYS): HTMLElement | null {
  const withData = bowls.filter((bowl) => bowl.readings.length >= 2);
  if (withData.length === 0) return null;

  const window: string[] = [];
  const today = new Date();
  for (let index = windowDays - 1; index >= 0; index -= 1) {
    window.push(localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - index)));
  }

  const series: BowlSeries[] = withData.map((bowl, index) => {
    const summary = summarizeBowlByDay(bowl.readings);
    const byDay = new Map(summary.days.map((day) => [day.day, day.consumptionGrams]));
    return {
      label: bowl.label,
      color: (index % SERIES_COUNT) + 1,
      values: window.map((day) => byDay.get(day) ?? null),
      average: summary.averageConsumptionGrams,
    };
  });

  const maxValue = Math.max(1, ...series.flatMap((item) => item.values.map((value) => value ?? 0)));
  const hi = Math.ceil(maxValue * 1.15);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = window.length > 1 ? plotWidth / (window.length - 1) : plotWidth;
  const x = (index: number) => PAD_LEFT + index * step;
  const y = (value: number) => PAD_TOP + (1 - value / hi) * plotHeight;

  const svg = svgEl("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: "chart", role: "img" });

  for (const tick of [0, Math.round(hi / 2), hi]) {
    svg.append(
      svgEl("line", {
        x1: PAD_LEFT,
        y1: y(tick),
        x2: WIDTH - PAD_RIGHT,
        y2: y(tick),
        class: "chart-grid",
      }),
      svgEl(
        "text",
        { x: PAD_LEFT - 8, y: y(tick) + 4, class: "chart-label", "text-anchor": "end" },
        `${tick} g`,
      ),
    );
  }

  const tip = svgEl("text", { x: PAD_LEFT, y: 15, class: "chart-tip" }, "");
  svg.append(tip);

  for (const item of series) {
    let path = "";
    let pen = false;
    item.values.forEach((value, index) => {
      if (value === null) {
        pen = false;
        return;
      }
      path += `${pen ? "L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)} `;
      pen = true;
    });
    if (path) {
      svg.append(svgEl("path", { d: path.trim(), class: `chart-line series-${item.color}` }));
    }
    item.values.forEach((value, index) => {
      if (value === null) return;
      const cx = x(index);
      const cy = y(value);
      const circle = svgEl("circle", {
        cx,
        cy,
        r: 4,
        class: `chart-point series-${item.color}`,
      });
      const text = `${item.label} · ${dayLabel(window[index])} · ${value} g`;
      circle.append(svgEl("title", null, text));
      const hit = svgEl("circle", { cx, cy, r: 14, class: "chart-hit" });
      const show = () => {
        tip.textContent = text;
      };
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("click", show);
      svg.append(hit, circle);
    });
  }

  for (const index of [0, Math.floor((window.length - 1) / 2), window.length - 1]) {
    svg.append(
      svgEl(
        "text",
        {
          x: x(index),
          y: HEIGHT - 12,
          class: "chart-label",
          "text-anchor": index === 0 ? "start" : index === window.length - 1 ? "end" : "middle",
        },
        dayLabel(window[index]),
      ),
    );
  }

  return h(
    "div",
    { class: "chart-wrap" },
    svg,
    h(
      "div",
      { class: "chart-legend" },
      series.map((item) =>
        h(
          "span",
          { class: "chart-legend-item" },
          h("span", { class: `chart-legend-dot series-${item.color}` }),
          h("span", null, item.label),
          h("span", { class: "dim small" }, `avg ${formatFoodAmount(item.average)}/day`),
        ),
      ),
    ),
  );
}

function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function svgEl(tag: string, attrs: Record<string, string | number> | null, text?: string): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  }
  if (text !== undefined) el.textContent = text;
  return el;
}
