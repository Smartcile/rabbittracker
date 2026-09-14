import type { HealthCheckDto } from "../../../shared/types.ts";
import { assessWeightChange, formatWeight } from "../../../shared/health.ts";
import { fmtDate, h } from "../dom.ts";

const WIDTH = 640;
const HEIGHT = 240;
const PAD_LEFT = 64;
const PAD_RIGHT = 16;
const PAD_TOP = 22;
const PAD_BOTTOM = 36;

export function renderWeightChart(checks: HealthCheckDto[], timezone?: string): HTMLElement {
  const points = checks
    .filter((check): check is HealthCheckDto & { weightGrams: number } => check.weightGrams !== null)
    .map((check) => ({ at: check.checkedAt, grams: check.weightGrams }))
    .sort((a, b) => a.at.localeCompare(b.at));

  if (points.length === 0) {
    return h("div", { class: "empty" }, "No weights recorded yet.");
  }
  if (points.length === 1) {
    return h("div", { class: "empty" }, `Only one weight recorded: ${formatWeight(points[0].grams)}.`);
  }

  const times = points.map((point) => Date.parse(point.at));
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;
  const grams = points.map((point) => point.grams);
  const minGrams = Math.min(...grams);
  const maxGrams = Math.max(...grams);
  const padGrams = Math.max(50, Math.round((maxGrams - minGrams) * 0.15));
  const loGrams = minGrams - padGrams;
  const hiGrams = maxGrams + padGrams;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (time: number) => PAD_LEFT + ((time - minTime) / timeSpan) * plotWidth;
  const y = (value: number) => PAD_TOP + (1 - (value - loGrams) / (hiGrams - loGrams)) * plotHeight;

  const svg = svgEl("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: "chart", role: "img" });

  const ticks = [loGrams, Math.round((loGrams + hiGrams) / 2), hiGrams];
  for (const tick of ticks) {
    svg.append(
      svgEl("line", { x1: PAD_LEFT, y1: y(tick), x2: WIDTH - PAD_RIGHT, y2: y(tick), class: "chart-grid" }),
      svgEl(
        "text",
        { x: PAD_LEFT - 8, y: y(tick) + 4, class: "chart-label", "text-anchor": "end" },
        formatWeight(tick),
      ),
    );
  }

  svg.append(
    svgEl("text", { x: PAD_LEFT, y: HEIGHT - 12, class: "chart-label", "text-anchor": "start" }, fmtDate(points[0].at, timezone)),
    svgEl(
      "text",
      { x: WIDTH - PAD_RIGHT, y: HEIGHT - 12, class: "chart-label", "text-anchor": "end" },
      fmtDate(points[points.length - 1].at, timezone),
    ),
  );

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(times[index]).toFixed(1)} ${y(point.grams).toFixed(1)}`)
    .join(" ");
  const baseline = (HEIGHT - PAD_BOTTOM).toFixed(1);
  const area = `${path} L ${x(times[times.length - 1]).toFixed(1)} ${baseline} L ${x(times[0]).toFixed(1)} ${baseline} Z`;
  svg.append(svgEl("path", { d: area, class: "chart-area" }));
  svg.append(svgEl("path", { d: path, class: "chart-line" }));

  const tip = svgEl("text", { x: PAD_LEFT, y: 14, class: "chart-tip" }, "");
  svg.append(tip);

  const show = (point: { at: string; grams: number }) => {
    tip.textContent = `${fmtDate(point.at, timezone)} · ${formatWeight(point.grams)}`;
  };

  points.forEach((point, index) => {
    const assessment =
      index === 0
        ? "ok"
        : assessWeightChange(points[index - 1].grams, point.grams, daysBetween(times[index - 1], times[index]));
    const cx = x(times[index]);
    const cy = y(point.grams);
    const circle = svgEl("circle", { cx, cy, r: 5, class: `chart-point ${assessment}` });
    circle.append(svgEl("title", null, `${fmtDate(point.at, timezone)} · ${formatWeight(point.grams)}`));
    const hit = svgEl("circle", { cx, cy, r: 16, class: "chart-hit" });
    hit.addEventListener("pointerenter", () => show(point));
    hit.addEventListener("click", () => show(point));
    svg.append(hit, circle);
  });

  return h("div", { class: "chart-wrap" }, svg);
}

function daysBetween(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function svgEl(tag: string, attrs: Record<string, string | number> | null, text?: string): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  }
  if (text !== undefined) el.textContent = text;
  return el;
}
