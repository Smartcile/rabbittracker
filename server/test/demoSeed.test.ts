import { describe, expect, it } from "vitest";
import { summarizeBowl } from "../../shared/bowls.ts";
import { needsAttention, weightSummary } from "../../shared/health.ts";
import { buildDemoDataset } from "../src/lib/demoSeed.ts";

const LAUNCH_DATES = [
  new Date(2026, 0, 1, 0, 30),
  new Date(2026, 1, 28, 23, 30),
  new Date(2026, 8, 14, 9, 0),
  new Date(2026, 11, 31, 23, 0),
];

describe("buildDemoDataset", () => {
  it("puts appointments in the current month at any launch date", () => {
    for (const now of LAUNCH_DATES) {
      const dataset = buildDemoDataset(now);
      const inMonth = dataset.appointments.filter(
        (appointment) =>
          appointment.scheduledAt.getFullYear() === now.getFullYear() &&
          appointment.scheduledAt.getMonth() === now.getMonth(),
      );
      expect(inMonth.length, `launch ${now.toDateString()}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("mixes completed and scheduled appointments when launched mid-month", () => {
    const dataset = buildDemoDataset(new Date(2026, 8, 14, 9, 0));
    const statuses = new Set(
      dataset.appointments
        .filter((appointment) => appointment.scheduledAt.getMonth() === 8)
        .map((appointment) => appointment.status),
    );
    expect(statuses.has("completed")).toBe(true);
    expect(statuses.has("scheduled")).toBe(true);
  });

  it("is deterministic for a given date", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    expect(buildDemoDataset(now)).toEqual(buildDemoDataset(now));
  });

  it("covers the newer features: targets, feeding plans, quarantine, bonds and journal", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    const dataset = buildDemoDataset(now);
    expect(dataset.rabbits.every((rabbit) => rabbit.feedingPlan.length > 0)).toBe(true);
    expect(dataset.rabbits.every((rabbit) => rabbit.targetWeightMinGrams < rabbit.targetWeightMaxGrams)).toBe(true);
    expect(dataset.rabbits.some((rabbit) => rabbit.quarantined && rabbit.quarantineUntil)).toBe(true);
    expect(dataset.bonds.length).toBeGreaterThan(0);
    for (const bond of dataset.bonds) {
      expect(dataset.rabbits[bond.a]).toBeDefined();
      expect(dataset.rabbits[bond.b]).toBeDefined();
    }
    expect(dataset.journal.length).toBeGreaterThan(0);
    for (const entry of dataset.journal) {
      expect(dataset.rabbits[entry.rabbitIndex]).toBeDefined();
      expect(entry.daysAgo).toBeGreaterThan(0);
    }
  });

  it("includes recent daily checks across the seeded types", () => {
    const dataset = buildDemoDataset(new Date(2026, 8, 14, 9, 0));
    expect(dataset.checkLogs.length).toBeGreaterThanOrEqual(10);
    expect(new Set(dataset.checkLogs.map((log) => log.typeKey))).toEqual(
      new Set(["poo", "behaviour"]),
    );
    for (const log of dataset.checkLogs) {
      expect(dataset.rabbits[log.rabbitIndex]).toBeDefined();
      expect(log.hoursAgo).toBeGreaterThan(0);
      expect(log.hoursAgo).toBeLessThan(7 * 24);
      expect(
        log.valueLabels.length > 0 ||
          log.valueMilli !== null ||
          log.valueText.length > 0 ||
          log.notes.length > 0,
      ).toBe(true);
    }
    expect(dataset.checkLogs.some((log) => log.valueLabels.length >= 2)).toBe(true);
  });

  it("logs doses for the active treatment", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    const dataset = buildDemoDataset(now);
    expect(dataset.medicationLogs.length).toBeGreaterThanOrEqual(3);
    for (const log of dataset.medicationLogs) {
      const treatment = dataset.treatments[log.treatmentIndex];
      expect(treatment).toBeDefined();
      expect(treatment?.status).toBe("active");
      expect(treatment?.rabbitIndex).toBe(log.rabbitIndex);
      expect(log.amountMilliUnits).toBeGreaterThan(0);
      const givenAt = now.getTime() - log.hoursAgo * 3_600_000;
      expect(givenAt).toBeLessThanOrEqual(now.getTime());
      expect(givenAt).toBeGreaterThanOrEqual(new Date(`${treatment?.startDate}T00:00:00`).getTime());
    }
  });

  it("includes bowls with consistent readings for each bunny", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    const dataset = buildDemoDataset(now);
    expect(dataset.bowls.length).toBeGreaterThanOrEqual(dataset.rabbits.length);
    expect(new Set(dataset.bowls.map((bowl) => bowl.rabbitIndex)).size).toBe(dataset.rabbits.length);
    for (const bowl of dataset.bowls) {
      expect(dataset.rabbits[bowl.rabbitIndex]).toBeDefined();
      expect(bowl.label.length).toBeGreaterThan(0);
      expect(bowl.readings[0]?.kind).toBe("start");
      for (const reading of bowl.readings) {
        expect(reading.hoursAgo).toBeGreaterThan(0);
        expect(reading.hoursAgo).toBeLessThan(7 * 24);
        expect(reading.weightGrams).toBeGreaterThan(0);
      }
    }
    const summary = summarizeBowl(
      dataset.bowls[0].readings.map((reading, index) => ({
        id: index + 1,
        readAt: new Date(now.getTime() - reading.hoursAgo * 3_600_000),
        kind: reading.kind,
        weightGrams: reading.weightGrams,
      })),
    );
    expect(summary.totalConsumptionGrams).toBeGreaterThan(0);
    expect(summary.totalRefillGrams).toBeGreaterThan(0);
  });

  it("includes routine tasks with completions", () => {
    const dataset = buildDemoDataset(new Date(2026, 8, 14, 9, 0));
    expect(dataset.tasks.length).toBeGreaterThanOrEqual(3);
    const slots = new Set(["morning", "afternoon", "evening", "anytime"]);
    for (const task of dataset.tasks) {
      expect(dataset.rabbits[task.rabbitIndex]).toBeDefined();
      expect(slots.has(task.slot)).toBe(true);
      expect(task.intervalDays).toBeGreaterThan(0);
      if (task.careKind) continue;
      for (const hours of task.completionsHoursAgo) {
        expect(hours).toBeGreaterThan(0);
        expect(hours).toBeLessThan(7 * 24);
      }
    }
    expect(dataset.tasks.some((task) => task.active)).toBe(true);
    expect(dataset.tasks.some((task) => !task.active)).toBe(true);
    expect(dataset.tasks.some((task) => task.completionsHoursAgo.length > 0)).toBe(true);
  });

  it("gives the latest check of each bunny a temperature, pain score and checklist", () => {
    const dataset = buildDemoDataset(new Date(2026, 8, 14, 9, 0));
    const latest = new Map<number, (typeof dataset.checks)[number]>();
    for (const check of dataset.checks) {
      const existing = latest.get(check.rabbitIndex);
      if (!existing || check.checkedAt > existing.checkedAt) latest.set(check.rabbitIndex, check);
    }
    expect(latest.size).toBe(dataset.rabbits.length);
    for (const check of latest.values()) {
      expect(check.temperatureTenthsC).not.toBeNull();
      expect(check.painScore).not.toBeNull();
      expect(Object.keys(check.checklist ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("keeps checks recent and weights positive", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    const dataset = buildDemoDataset(now);
    expect(dataset.checks.length).toBeGreaterThanOrEqual(12);
    for (const check of dataset.checks) {
      expect(check.checkedAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(check.checkedAt.getTime()).toBeGreaterThan(now.getTime() - 60 * 86_400_000);
      expect(check.weightGrams).toBeGreaterThan(0);
    }
  });

  it("includes a weight alert, due vaccinations, overdue care and a follow-up", () => {
    const now = new Date(2026, 8, 14, 9, 0);
    const dataset = buildDemoDataset(now);

    const checksByRabbit = new Map<number, { checkedAt: string; weightGrams: number }[]>();
    for (const check of dataset.checks) {
      const list = checksByRabbit.get(check.rabbitIndex) ?? [];
      list.push({ checkedAt: check.checkedAt.toISOString(), weightGrams: check.weightGrams });
      checksByRabbit.set(check.rabbitIndex, list);
    }
    const lastCare = new Map<string, string>();
    for (const task of dataset.tasks) {
      if (!task.careKind) continue;
      for (const hours of task.completionsHoursAgo) {
        const key = `${task.rabbitIndex}:${task.careKind}`;
        const doneAt = new Date(now.getTime() - hours * 3_600_000).toISOString();
        const existing = lastCare.get(key);
        if (!existing || doneAt > existing) lastCare.set(key, doneAt);
      }
    }

    const badges = dataset.rabbits.flatMap((_, rabbitIndex) => {
      const weights = weightSummary(checksByRabbit.get(rabbitIndex) ?? []);
      return needsAttention(
        {
          weightAlert: weights.weightAlert,
          vaccinations: dataset.vaccinations
            .filter((vaccination) => vaccination.rabbitIndex === rabbitIndex)
            .map((vaccination) => ({
              vaccine: vaccination.vaccine,
              nextDueAt: vaccination.nextDueAt,
            })),
          care: dataset.tasks
            .filter((task) => task.rabbitIndex === rabbitIndex && task.careKind)
            .map((task) => ({
              kind: task.careKind as string,
              lastDoneAt: lastCare.get(`${rabbitIndex}:${task.careKind}`) ?? null,
              intervalDays: task.intervalDays,
            })),
          followUps: dataset.appointments
            .filter(
              (appointment) => appointment.rabbitIndex === rabbitIndex && appointment.followUpAt,
            )
            .map((appointment) => ({
              title: appointment.title,
              followUpAt: (appointment.followUpAt as Date).toISOString(),
            })),
        },
        now,
      );
    });

    const kinds = new Set(badges.map((badge) => badge.kind));
    expect(kinds.has("weight")).toBe(true);
    expect(kinds.has("vaccination")).toBe(true);
    expect(kinds.has("care")).toBe(true);
    expect(kinds.has("follow-up")).toBe(true);
    expect(badges.some((badge) => badge.severity === "alert")).toBe(true);
  });
});
