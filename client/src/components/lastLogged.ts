import { fmtDate, fmtTime, h } from "../dom.ts";

export function lastLoggedLine(label: string, value: string | Date | null | undefined): HTMLElement {
  const when = value ? `${fmtDate(value)} ${fmtTime(value)}` : "never";
  return h("p", { class: "dim small", style: { margin: "0.35rem 0 0" } }, `${label}: ${when}`);
}
