import type { BowlDto } from "../../../shared/types.ts";
import { summarizeBowlByDay } from "../../../shared/bowls.ts";
import { formatFoodAmount } from "../../../shared/food.ts";
import type { ReportRange } from "../../../shared/report.ts";
import { h } from "../dom.ts";

const WIDTH = 640;
const HEIGHT = 240;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 26;
const PAD_BOTTOM = 40;
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 92;
const SERIES_COUNT = 5;

type BowlSeries = {
  label: string;
  color: number;
  values: (number | null)[];
  average: number;
};

export function renderBowlsChart(bowls: BowlDto[], range?: ReportRange): HTMLElement | null {
  const withData = bowls.filter((bowl) => bowl.readings.length >= 2);
  if (withData.length === 0) return null;

  const window = buildWindow(withData, range);
  if (window.length === 0) return null;

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

function buildWindow(bowls: BowlDto[], range?: ReportRange): string[] {
  const today = new Date();
  const todayKey = localDayKey(today);
  if (!range) {
    return dayKeys(shiftDays(today, -(DEFAULT_WINDOW_DAYS - 1)), today);
  }
  const readingDays = bowls
    .flatMap((bowl) => bowl.readings.map((reading) => localDayKey(new Date(reading.readAt))))
    .sort();
  const first = readingDays[0] ?? todayKey;
  const last = readingDays[readingDays.length - 1] ?? todayKey;
  const start = parseDayKey(range.from ? localDayKey(range.from) : first);
  const end = parseDayKey(range.to ? localDayKey(range.to) : last);
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const from = span > MAX_WINDOW_DAYS ? shiftDays(end, -(MAX_WINDOW_DAYS - 1)) : start;
  return dayKeys(from, end);
}

function dayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last && keys.length < 3700) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
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
