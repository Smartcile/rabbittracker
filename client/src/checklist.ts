import type { ChecklistSectionDto } from "../../shared/types.ts";
import { api } from "./api.ts";

let cache: ChecklistSectionDto[] | null = null;

export async function loadChecklist(force = false): Promise<ChecklistSectionDto[]> {
  if (!cache || force) {
    const result = await api.get<{ sections: ChecklistSectionDto[] }>("/api/checklist");
    cache = result.sections;
  }
  return cache;
}

export function invalidateChecklist(): void {
  cache = null;
}
