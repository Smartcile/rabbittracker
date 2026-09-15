import type { ChecklistSectionDto } from "../../shared/types.ts";
import { api } from "./api.ts";

let cache: { sections: ChecklistSectionDto[]; typeKeys: string[] } | null = null;

async function loadConfig(force = false): Promise<{ sections: ChecklistSectionDto[]; typeKeys: string[] }> {
  if (!cache || force) {
    const result = await api.get<{ sections: ChecklistSectionDto[]; typeKeys?: string[] }>(
      "/api/checklist",
    );
    cache = { sections: result.sections, typeKeys: result.typeKeys ?? [] };
  }
  return cache;
}

export async function loadChecklist(force = false): Promise<ChecklistSectionDto[]> {
  return (await loadConfig(force)).sections;
}

export async function loadChecklistTypeKeys(force = false): Promise<string[]> {
  return (await loadConfig(force)).typeKeys;
}

export function invalidateChecklist(): void {
  cache = null;
}
