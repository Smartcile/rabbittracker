import { describe, expect, it } from "vitest";
import { emptyChecklist } from "../../shared/checklist.ts";
import { DEFAULT_RECURRENCE } from "../../shared/recurrence.ts";
import {
  appointmentToDto,
  calendarEventToDto,
  calendarSubscriptionToDto,
  faqEntryToDto,
  groupFaqEntries,
  healthCheckToDto,
  rabbitToDto,
  settingsToDto,
  treatmentToDto,
  userToDto,
  vaccinationToDto,
  vetToDto,
} from "../src/api/mappers.ts";
import type {
  AppointmentRow,
  CalendarEventRow,
  CalendarSubscriptionRow,
  FaqEntryRow,
  HealthCheckRow,
  RabbitRow,
  SettingsRow,
  TreatmentRow,
  UserRow,
  VaccinationRow,
  VetRow,
} from "../src/db/schema.ts";

describe("userToDto", () => {
  it("maps a user row to a camelCase DTO", () => {
    const row: UserRow = {
      id: 7,
      username: "alice",
      displayName: "Alice",
      passwordHash: "secret-hash",
      pinHash: null,
      isAdmin: true,
      active: true,
      canCreateRabbits: false,
      canRecordHealth: true,
      canEditRabbits: false,
      canViewCosts: false,
      canManageCalendar: false,
      canEditFaq: false,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    };
    expect(userToDto(row)).toEqual({
      id: 7,
      username: "alice",
      displayName: "Alice",
      isAdmin: true,
      active: true,
      hasPin: false,
      canCreateRabbits: false,
      canRecordHealth: true,
      canEditRabbits: false,
      canViewCosts: false,
      canManageCalendar: false,
      canEditFaq: false,
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("reports when a PIN is set", () => {
    const row: UserRow = {
      id: 8,
      username: "foster",
      displayName: "Foster",
      passwordHash: "secret-hash",
      pinHash: "pin-hash",
      isAdmin: false,
      active: true,
      canCreateRabbits: true,
      canRecordHealth: true,
      canEditRabbits: false,
      canViewCosts: false,
      canManageCalendar: false,
      canEditFaq: false,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    };
    expect(userToDto(row).hasPin).toBe(true);
    expect(userToDto(row).canCreateRabbits).toBe(true);
  });
});

describe("vetToDto", () => {
  it("maps a vet row", () => {
    const row: VetRow = {
      id: 4,
      name: "Dr. Patel",
      clinicId: 7,
      phone: "021 555 0101",
      email: "vet@example.com",
      address: "12 Main Street",
      notes: "Rabbit-savvy",
      isDemo: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    expect(vetToDto(row, "Happy Paws")).toEqual({
      id: 4,
      name: "Dr. Patel",
      clinicId: 7,
      clinic: "Happy Paws",
      phone: "021 555 0101",
      email: "vet@example.com",
      address: "12 Main Street",
      notes: "Rabbit-savvy",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("keeps an empty clinic name when unlinked", () => {
    const row: VetRow = {
      id: 5,
      name: "Dr. Solo",
      clinicId: null,
      phone: "",
      email: "",
      address: "",
      notes: "",
      isDemo: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(vetToDto(row).clinic).toBe("");
  });
});

describe("appointmentToDto cost hiding", () => {
  const row: AppointmentRow = {
    id: 8,
    rabbitId: 2,
    title: "Annual check",
    clinic: "Happy Paws",
    vet: "Dr Vet",
    location: "12 Main St",
    scheduledAt: new Date("2026-07-01T02:00:00.000Z"),
    status: "scheduled",
    costCents: 12500,
    followUpAt: null,
    eventUid: null,
    notes: "",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  };

  it("keeps the cost by default", () => {
    expect(appointmentToDto(row).costCents).toBe(12500);
  });

  it("hides the cost when asked", () => {
    expect(appointmentToDto(row, true).costCents).toBeNull();
  });
});

describe("settingsToDto", () => {
  it("maps the timezone and feed token", () => {
    const row: SettingsRow = {
      id: 1,
      timezone: "Pacific/Auckland",
      feedToken: "abc123",
      shareToken: "def456",
      demoMode: true,
      foodMinGramsPerKg: 20,
      foodMaxGramsPerKg: 60,
      waterMinMilliLitresPerKg: 50,
      waterMaxMilliLitresPerKg: 150,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(settingsToDto(row)).toEqual({
      timezone: "Pacific/Auckland",
      feedToken: "abc123",
      shareToken: "def456",
      demoMode: true,
      foodMinGramsPerKg: 20,
      foodMaxGramsPerKg: 60,
      waterMinMilliLitresPerKg: 50,
      waterMaxMilliLitresPerKg: 150,
    });
  });
});

describe("calendarSubscriptionToDto", () => {
  it("maps a subscription with sync state", () => {
    const row: CalendarSubscriptionRow = {
      id: 2,
      label: "Vet calendar",
      url: "https://example.com/cal.ics",
      lastSyncAt: new Date("2026-05-01T10:00:00.000Z"),
      syncError: "boom",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(calendarSubscriptionToDto(row)).toEqual({
      id: 2,
      label: "Vet calendar",
      url: "https://example.com/cal.ics",
      lastSyncAt: "2026-05-01T10:00:00.000Z",
      syncError: "boom",
    });
  });

  it("keeps a null sync state", () => {
    const row: CalendarSubscriptionRow = {
      id: 3,
      label: "Work",
      url: "webcal://example.com/cal.ics",
      lastSyncAt: null,
      syncError: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const dto = calendarSubscriptionToDto(row);
    expect(dto.lastSyncAt).toBeNull();
    expect(dto.syncError).toBeNull();
  });
});

describe("rabbitToDto", () => {
  it("maps a rabbit row to a camelCase DTO", () => {
    const row: RabbitRow = {
      id: 3,
      name: "Clover",
      sex: "female",
      breed: "Lionhead",
      colour: "White",
      dateOfBirth: "2023-04-01",
      desexed: true,
      microchip: "982000000000000",
      notes: "Loves parsley",
      status: "active",
      hasAvatar: true,
      isDemo: false,
      quarantined: true,
      quarantineUntil: "2026-01-20",
      targetWeightMinGrams: 2200,
      targetWeightMaxGrams: 2500,
      feedingPlan: "Pellets 1/4 cup, unlimited hay",
      deceasedAt: null,
      deceasedReason: "",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    };
    expect(rabbitToDto(row)).toEqual({
      id: 3,
      name: "Clover",
      sex: "female",
      breed: "Lionhead",
      colour: "White",
      dateOfBirth: "2023-04-01",
      desexed: true,
      microchip: "982000000000000",
      notes: "Loves parsley",
      status: "active",
      hasAvatar: true,
      quarantined: true,
      quarantineUntil: "2026-01-20",
      targetWeightMinGrams: 2200,
      targetWeightMaxGrams: 2500,
      feedingPlan: "Pellets 1/4 cup, unlimited hay",
      deceasedAt: null,
      deceasedReason: "",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
  });

  it("keeps a null date of birth", () => {
    const row: RabbitRow = {
      id: 4,
      name: "Biscuit",
      sex: "male",
      breed: "",
      colour: "",
      dateOfBirth: null,
      desexed: false,
      microchip: "",
      notes: "",
      status: "deceased",
      hasAvatar: false,
      isDemo: false,
      quarantined: false,
      quarantineUntil: null,
      targetWeightMinGrams: null,
      targetWeightMaxGrams: null,
      feedingPlan: "",
      deceasedAt: "2026-01-05",
      deceasedReason: "Old age",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-01-02T03:04:05.000Z"),
    };
    expect(rabbitToDto(row).dateOfBirth).toBeNull();
    expect(rabbitToDto(row).status).toBe("deceased");
    expect(rabbitToDto(row).deceasedAt).toBe("2026-01-05");
  });
});

describe("healthCheckToDto", () => {
  it("maps a full check row to a camelCase DTO", () => {
    const row: HealthCheckRow = {
      id: 11,
      rabbitId: 3,
      checkedAt: new Date("2026-05-01T08:30:00.000Z"),
      weightGrams: 2350,
      appetite: "normal",
      droppings: "small",
      energy: "low",
      bodyCondition: 3,
      temperatureTenthsC: 385,
      painScore: 4,
      checklist: {
        ...emptyChecklist(),
        posture: { values: ["hunched"], other: "" },
        nails: { values: ["clipping_soon", "broken"], other: "back left" },
      },
      notes: "Slightly quiet",
      hasPhoto: true,
      createdAt: new Date("2026-05-01T08:31:00.000Z"),
    };
    const dto = healthCheckToDto(row);
    expect(dto).toEqual({
      id: 11,
      rabbitId: 3,
      checkedAt: "2026-05-01T08:30:00.000Z",
      weightGrams: 2350,
      appetite: "normal",
      droppings: "small",
      energy: "low",
      bodyCondition: 3,
      temperatureTenthsC: 385,
      painScore: 4,
      checklist: {
        ...emptyChecklist(),
        posture: { values: ["hunched"], other: "" },
        nails: { values: ["clipping_soon", "broken"], other: "back left" },
      },
      notes: "Slightly quiet",
      hasPhoto: true,
      createdAt: "2026-05-01T08:31:00.000Z",
    });
  });

  it("keeps null status fields", () => {
    const row: HealthCheckRow = {
      id: 12,
      rabbitId: 3,
      checkedAt: new Date("2026-05-01T08:30:00.000Z"),
      weightGrams: null,
      appetite: null,
      droppings: null,
      energy: null,
      bodyCondition: null,
      temperatureTenthsC: null,
      painScore: null,
      checklist: null,
      notes: "Just notes",
      hasPhoto: false,
      createdAt: new Date("2026-05-01T08:31:00.000Z"),
    };
    const dto = healthCheckToDto(row);
    expect(dto.weightGrams).toBeNull();
    expect(dto.appetite).toBeNull();
    expect(dto.hasPhoto).toBe(false);
    expect(dto.checklist).toEqual(emptyChecklist());
  });
});

describe("treatmentToDto", () => {
  it("maps a treatment row", () => {
    const row: TreatmentRow = {
      id: 5,
      rabbitId: 2,
      medication: "Meloxicam",
      dose: "0.3 ml",
      route: "oral",
      frequency: "once daily",
      slots: ["morning"],
      recurrence: DEFAULT_RECURRENCE,
      reason: "Post-op pain",
      startDate: "2026-05-01",
      endDate: "2026-05-10",
      status: "active",
      notes: "With food",
      drugId: 3,
      doseMilliUnits: 1200,
      stockDeductedMilliUnits: 1200,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    };
    expect(treatmentToDto(row)).toEqual({
      id: 5,
      rabbitId: 2,
      medication: "Meloxicam",
      dose: "0.3 ml",
      route: "oral",
      frequency: "once daily",
      slots: ["morning"],
      recurrence: DEFAULT_RECURRENCE,
      reason: "Post-op pain",
      startDate: "2026-05-01",
      endDate: "2026-05-10",
      status: "active",
      notes: "With food",
      drugId: 3,
      doseMilliUnits: 1200,
      stockDeductedMilliUnits: 1200,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    });
  });

  it("keeps a null end date", () => {
    const row: TreatmentRow = {
      id: 6,
      rabbitId: 2,
      medication: "Baytril",
      dose: "",
      route: "",
      frequency: "",
      slots: [],
      recurrence: DEFAULT_RECURRENCE,
      reason: "",
      startDate: "2026-05-01",
      endDate: null,
      status: "stopped",
      notes: "",
      drugId: null,
      doseMilliUnits: null,
      stockDeductedMilliUnits: 0,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    };
    expect(treatmentToDto(row).endDate).toBeNull();
  });
});

describe("vaccinationToDto", () => {
  it("maps a vaccination row", () => {
    const row: VaccinationRow = {
      id: 9,
      rabbitId: 2,
      vaccine: "RHDV2",
      givenAt: "2026-03-01",
      nextDueAt: "2027-03-01",
      vet: "Dr Vet",
      batch: "A123",
      notes: "",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    };
    expect(vaccinationToDto(row)).toEqual({
      id: 9,
      rabbitId: 2,
      vaccine: "RHDV2",
      givenAt: "2026-03-01",
      nextDueAt: "2027-03-01",
      vet: "Dr Vet",
      batch: "A123",
      notes: "",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
  });
});

describe("appointmentToDto", () => {
  it("maps a full appointment row", () => {
    const row: AppointmentRow = {
      id: 8,
      rabbitId: 2,
      title: "Annual check",
      clinic: "Happy Paws",
      vet: "Dr Vet",
      location: "12 Main St",
      scheduledAt: new Date("2026-07-01T02:00:00.000Z"),
      status: "scheduled",
      costCents: 12500,
      followUpAt: new Date("2026-07-15T02:00:00.000Z"),
      eventUid: "event-1@test",
      notes: "Bring hay",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    };
    expect(appointmentToDto(row)).toEqual({
      id: 8,
      rabbitId: 2,
      title: "Annual check",
      clinic: "Happy Paws",
      vet: "Dr Vet",
      location: "12 Main St",
      scheduledAt: "2026-07-01T02:00:00.000Z",
      status: "scheduled",
      costCents: 12500,
      followUpAt: "2026-07-15T02:00:00.000Z",
      eventUid: "event-1@test",
      notes: "Bring hay",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });
  });

  it("keeps optional fields null", () => {
    const row: AppointmentRow = {
      id: 9,
      rabbitId: 2,
      title: "Check",
      clinic: "",
      vet: "",
      location: "",
      scheduledAt: new Date("2026-07-01T02:00:00.000Z"),
      status: "completed",
      costCents: null,
      followUpAt: null,
      eventUid: null,
      notes: "",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    };
    const dto = appointmentToDto(row);
    expect(dto.costCents).toBeNull();
    expect(dto.followUpAt).toBeNull();
    expect(dto.eventUid).toBeNull();
  });
});

describe("calendarEventToDto", () => {
  it("maps an all-day event", () => {
    const row: CalendarEventRow = {
      id: 1,
      subscriptionId: 2,
      uid: "event-2@test",
      summary: "All day reminder",
      location: "",
      description: "",
      startAt: new Date("2026-09-20T00:00:00.000Z"),
      endAt: new Date("2026-09-21T00:00:00.000Z"),
      allDay: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(calendarEventToDto(row)).toEqual({
      id: 1,
      uid: "event-2@test",
      summary: "All day reminder",
      location: "",
      description: "",
      startAt: "2026-09-20T00:00:00.000Z",
      endAt: "2026-09-21T00:00:00.000Z",
      allDay: true,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("keeps a missing start date", () => {
    const row: CalendarEventRow = {
      id: 2,
      subscriptionId: 2,
      uid: "event-3@test",
      summary: "",
      location: "",
      description: "",
      startAt: null,
      endAt: null,
      allDay: false,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(calendarEventToDto(row).startAt).toBeNull();
  });
});

describe("faq mappers", () => {
  function row(overrides: Partial<FaqEntryRow>): FaqEntryRow {
    return {
      id: 1,
      category: "Diet",
      question: "What should my rabbit eat?",
      answer: "Mostly hay.",
      sortOrder: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("maps an FAQ entry row", () => {
    expect(faqEntryToDto(row({}))).toEqual({
      id: 1,
      category: "Diet",
      question: "What should my rabbit eat?",
      answer: "Mostly hay.",
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("groups entries by category and sorts them", () => {
    const groups = groupFaqEntries([
      row({ id: 3, category: "Health", question: "B", sortOrder: 1 }),
      row({ id: 1, category: "Diet", question: "A", sortOrder: 0 }),
      row({ id: 2, category: "Health", question: "A", sortOrder: 0 }),
      row({ id: 4, category: "Diet", question: "C", sortOrder: 1 }),
    ]);
    expect(groups.map((group) => group.category)).toEqual(["Diet", "Health"]);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual([1, 4]);
    expect(groups[1].entries.map((entry) => entry.id)).toEqual([2, 3]);
  });

  it("returns an empty list for no entries", () => {
    expect(groupFaqEntries([])).toEqual([]);
  });
});
