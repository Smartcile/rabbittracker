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
