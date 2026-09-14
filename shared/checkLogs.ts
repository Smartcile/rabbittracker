import type { CheckLogDto } from "./types.ts";

export function formatLogNumber(valueMilli: number, unit: string): string {
  const value = Number((valueMilli / 1000).toFixed(3));
  return unit ? `${value} ${unit}` : String(value);
}

export function checkLogValueParts(
  log: Pick<CheckLogDto, "valueLabels" | "valueText" | "valueMilli" | "typeUnit">,
): string[] {
  const parts = [...log.valueLabels];
  if (log.valueText) parts.push(log.valueText);
  if (log.valueMilli != null) parts.push(formatLogNumber(log.valueMilli, log.typeUnit));
  return parts;
}

export function checkLogValueSummary(
  log: Pick<CheckLogDto, "valueLabels" | "valueText" | "valueMilli" | "typeUnit">,
): string {
  return checkLogValueParts(log).join(" · ");
}
