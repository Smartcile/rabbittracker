import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema.ts";

const REPORTED_TABLES = new Set([
  "appointments",
  "bowls",
  "care_records",
  "care_schedules",
  "check_logs",
  "health_checks",
  "journal_entries",
  "medication_logs",
  "rabbit_bonds",
  "rabbit_carers",
  "rabbit_stage_completions",
  "rabbit_tasks",
  "treatments",
  "vaccinations",
]);

const NON_REPORT_TABLES = new Set(["calendar_entries"]);

describe("bunny report coverage", () => {
  it("accounts for every table that stores rabbit-scoped data", () => {
    const values: unknown[] = Object.values(schema);
    const unaccounted = values
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => getTableConfig(table))
      .filter((config) => config.columns.some((column) => column.name === "rabbit_id"))
      .map((config) => config.name)
      .filter((name) => !REPORTED_TABLES.has(name) && !NON_REPORT_TABLES.has(name));
    expect(
      unaccounted,
      `Add these tables to server/src/services/reportBundle.ts (and the report sections) or to NON_REPORT_TABLES: ${unaccounted.join(", ")}`,
    ).toEqual([]);
  });
});
