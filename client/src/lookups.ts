import type { LookupDto } from "../../shared/types.ts";
import { api } from "./api.ts";

let cache: LookupDto[] | null = null;

export async function loadLookups(force = false): Promise<LookupDto[]> {
  if (!cache || force) {
    const result = await api.get<{ lookups: LookupDto[] }>("/api/lookups");
    cache = result.lookups;
  }
  return cache;
}

export function invalidateLookups(): void {
  cache = null;
}
