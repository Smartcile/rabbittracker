import type { CheckLogTypeDto } from "../../shared/types.ts";
import { api } from "./api.ts";

let cache: CheckLogTypeDto[] | null = null;

export async function loadCheckLogTypes(force = false): Promise<CheckLogTypeDto[]> {
  if (!cache || force) {
    const result = await api.get<{ types: CheckLogTypeDto[] }>("/api/check-logs/types");
    cache = result.types;
  }
  return cache;
}

export function invalidateCheckLogTypes(): void {
  cache = null;
}

export function formatLogNumber(valueMilli: number, unit: string): string {
  const value = Number((valueMilli / 1000).toFixed(3));
  return unit ? `${value} ${unit}` : String(value);
}
