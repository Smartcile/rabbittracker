import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHECKLIST_SECTIONS,
  slugifyLabel,
  validateChecklistAnswers,
} from "../../shared/checklist.ts";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  bowlCreateSchema,
  bowlReadingCreateSchema,
  bowlUpdateSchema,
  calendarEntryCreateSchema,
  calendarSubscriptionSchema,
  calendarSubscriptionUpdateSchema,
  checkLogCreateSchema,
  checkLogTypeCreateSchema,
  medicationLogCreateSchema,
  medicationLogUpdateSchema,
  careRecordCreateSchema,
  careSchedulePutSchema,
  checkCreateSchema,
  checkUpdateSchema,
  checklistSchema,
  clinicCreateSchema,
  clinicUpdateSchema,
  faqCreateSchema,
  faqReorderSchema,
  faqUpdateSchema,
  hasCheckContent,
  hasChecklistContent,
  loginSchema,
  lookupCreateSchema,
  lookupUpdateSchema,
  passwordSchema,
  pinSchema,
  pinSetSchema,
  rabbitBondsPutSchema,
  rabbitCarersPutSchema,
  rabbitCreateSchema,
  rabbitUpdateSchema,
  setupSchema,
  taskCompleteSchema,
  taskCreateSchema,
  taskUpdateSchema,
  treatmentCreateSchema,
  userCreateSchema,
  userUpdateSchema,
  vaccinationCreateSchema,
  vetCreateSchema,
  vetUpdateSchema,
} from "../src/lib/validation.ts";

describe("username validation", () => {
  it("accepts a valid lowercase username", () => {
    const result = setupSchema.safeParse({ username: "alice", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("normalises case and surrounding whitespace", () => {
    const result = setupSchema.parse({ username: "  Alice ", password: "password123" });
    expect(result.username).toBe("alice");
  });

  it("rejects usernames shorter than 3 characters", () => {
    expect(loginSchema.safeParse({ username: "ab", password: "x" }).success).toBe(false);
  });

  it("rejects usernames longer than 32 characters", () => {
    const username = "a".repeat(33);
    expect(loginSchema.safeParse({ username, password: "x" }).success).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(loginSchema.safeParse({ username: "alice!", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "al ice", password: "x" }).success).toBe(false);
  });

  it("accepts dots, underscores and hyphens", () => {
    expect(loginSchema.safeParse({ username: "a.b_c-d", password: "x" }).success).toBe(true);
  });
});

describe("password validation", () => {
  it("requires at least 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(passwordSchema.safeParse(12345678).success).toBe(false);
  });
});

describe("pin validation", () => {
  it("accepts 4 to 8 digits", () => {
    expect(pinSchema.safeParse({ pin: "1234" }).success).toBe(true);
    expect(pinSchema.safeParse({ pin: "12345678" }).success).toBe(true);
  });

  it("rejects short, long and non-numeric pins", () => {
    expect(pinSchema.safeParse({ pin: "123" }).success).toBe(false);
    expect(pinSchema.safeParse({ pin: "123456789" }).success).toBe(false);
    expect(pinSchema.safeParse({ pin: "12ab" }).success).toBe(false);
    expect(pinSchema.safeParse({ pin: "" }).success).toBe(false);
  });
});

describe("user create validation", () => {
  it("requires a password for admins", () => {
    expect(userCreateSchema.safeParse({ username: "alice", isAdmin: true }).success).toBe(false);
    expect(
      userCreateSchema.safeParse({ username: "alice", isAdmin: true, password: "password123" }).success,
    ).toBe(true);
  });

  it("requires a PIN for workers", () => {
    expect(userCreateSchema.safeParse({ username: "foster", isAdmin: false }).success).toBe(false);
    expect(userCreateSchema.safeParse({ username: "foster", isAdmin: false, pin: "12" }).success).toBe(false);
    expect(userCreateSchema.safeParse({ username: "foster", isAdmin: false, pin: "1234" }).success).toBe(true);
  });

  it("applies worker permission defaults", () => {
    const result = userCreateSchema.parse({ username: "foster", isAdmin: false, pin: "1234" });
    expect(result).toMatchObject({
      canRecordHealth: true,
      canCreateRabbits: false,
      canEditRabbits: false,
      canViewCosts: false,
      canManageCalendar: false,
      canEditFaq: false,
    });
  });

  it("accepts explicit worker permissions", () => {
    const result = userCreateSchema.parse({
      username: "foster",
      isAdmin: false,
      pin: "1234",
      canViewCosts: true,
      canCreateRabbits: true,
    });
    if (result.isAdmin) throw new Error("expected a worker");
    expect(result.canViewCosts).toBe(true);
    expect(result.canCreateRabbits).toBe(true);
  });
});

describe("pin set validation", () => {
  it("accepts 4 to 8 digits", () => {
    expect(pinSetSchema.safeParse({ pin: "1234" }).success).toBe(true);
    expect(pinSetSchema.safeParse({ pin: "12345678" }).success).toBe(true);
  });

  it("accepts null to remove the PIN", () => {
    expect(pinSetSchema.safeParse({ pin: null }).success).toBe(true);
  });

  it("rejects invalid PINs", () => {
    expect(pinSetSchema.safeParse({ pin: "123" }).success).toBe(false);
    expect(pinSetSchema.safeParse({ pin: "12ab" }).success).toBe(false);
  });
});

describe("user update validation", () => {
  it("rejects an empty patch", () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial patch", () => {
    expect(userUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });

  it("accepts setting and clearing a PIN", () => {
    expect(userUpdateSchema.safeParse({ pin: "4321" }).success).toBe(true);
    expect(userUpdateSchema.safeParse({ pin: null }).success).toBe(true);
  });

  it("rejects an invalid PIN", () => {
    expect(userUpdateSchema.safeParse({ pin: "abc" }).success).toBe(false);
  });

  it("accepts permission patches", () => {
    expect(userUpdateSchema.safeParse({ canEditFaq: true }).success).toBe(true);
    expect(userUpdateSchema.safeParse({ canViewCosts: false }).success).toBe(true);
  });
});

describe("rabbit carers validation", () => {
  it("accepts a list of user ids", () => {
    expect(rabbitCarersPutSchema.safeParse({ userIds: [1, 2, 3] }).success).toBe(true);
  });

  it("accepts an empty list", () => {
    expect(rabbitCarersPutSchema.safeParse({ userIds: [] }).success).toBe(true);
  });

  it("rejects non-positive and non-integer ids", () => {
    expect(rabbitCarersPutSchema.safeParse({ userIds: [0] }).success).toBe(false);
    expect(rabbitCarersPutSchema.safeParse({ userIds: [1.5] }).success).toBe(false);
    expect(rabbitCarersPutSchema.safeParse({ userIds: ["1"] }).success).toBe(false);
  });
});

describe("calendar subscription validation", () => {
  it("accepts an https url", () => {
    const result = calendarSubscriptionSchema.parse({
      url: "https://example.com/calendar.ics",
      label: "Vet",
    });
    expect(result.url).toBe("https://example.com/calendar.ics");
  });

  it("accepts a webcal url", () => {
    const result = calendarSubscriptionSchema.parse({
      url: "webcal://example.com/calendar.ics",
      label: "Vet",
    });
    expect(result.url).toBe("webcal://example.com/calendar.ics");
  });

  it("rejects a non-url string", () => {
    expect(
      calendarSubscriptionSchema.safeParse({ url: "not a url", label: "Vet" }).success,
    ).toBe(false);
  });

  it("requires a label and url", () => {
    expect(
      calendarSubscriptionSchema.safeParse({ url: "https://example.com/cal.ics", label: " " })
        .success,
    ).toBe(false);
    expect(calendarSubscriptionSchema.safeParse({ label: "Vet" }).success).toBe(false);
  });

  it("rejects an empty update patch", () => {
    expect(calendarSubscriptionUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(calendarSubscriptionUpdateSchema.safeParse({ label: "Work" }).success).toBe(true);
  });
});

describe("rabbit validation", () => {
  it("accepts a minimal rabbit and applies defaults", () => {
    const result = rabbitCreateSchema.parse({ name: "Clover" });
    expect(result).toMatchObject({
      name: "Clover",
      sex: "unknown",
      breed: "",
      colour: "",
      desexed: false,
      microchip: "",
      notes: "",
      status: "active",
    });
    expect(result.dateOfBirth).toBeUndefined();
  });

  it("requires a name", () => {
    expect(rabbitCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects unknown sex and status values", () => {
    expect(rabbitCreateSchema.safeParse({ name: "Clover", sex: "other" }).success).toBe(false);
    expect(rabbitCreateSchema.safeParse({ name: "Clover", status: "archived" }).success).toBe(false);
  });

  it("accepts an empty date of birth as null", () => {
    const result = rabbitCreateSchema.parse({ name: "Clover", dateOfBirth: "" });
    expect(result.dateOfBirth).toBeNull();
  });

  it("rejects a malformed date of birth", () => {
    expect(rabbitCreateSchema.safeParse({ name: "Clover", dateOfBirth: "01/04/2023" }).success).toBe(
      false,
    );
    expect(rabbitCreateSchema.safeParse({ name: "Clover", dateOfBirth: "2023-02-31" }).success).toBe(
      false,
    );
  });

  it("accepts a valid ISO date of birth", () => {
    const result = rabbitCreateSchema.parse({ name: "Clover", dateOfBirth: "2023-04-01" });
    expect(result.dateOfBirth).toBe("2023-04-01");
  });

  it("rejects an empty update patch", () => {
    expect(rabbitUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(rabbitUpdateSchema.safeParse({ status: "deceased" }).success).toBe(true);
  });

  it("allows clearing the date of birth with an empty string", () => {
    const result = rabbitUpdateSchema.parse({ dateOfBirth: "" });
    expect(result.dateOfBirth).toBeNull();
  });

  it("accepts the care fields: quarantine, target weight, feeding plan and memorial", () => {
    const result = rabbitCreateSchema.parse({
      name: "Clover",
      quarantined: true,
      quarantineUntil: "2026-02-01",
      targetWeightMinGrams: 2200,
      targetWeightMaxGrams: 2500,
      feedingPlan: "Unlimited hay, 1/4 cup pellets",
      deceasedAt: "2026-01-05",
      deceasedReason: "Old age",
    });
    expect(result.quarantined).toBe(true);
    expect(result.quarantineUntil).toBe("2026-02-01");
    expect(result.targetWeightMinGrams).toBe(2200);
    expect(result.feedingPlan).toBe("Unlimited hay, 1/4 cup pellets");
    expect(result.deceasedAt).toBe("2026-01-05");
  });

  it("accepts bonded bunny ids", () => {
    expect(rabbitBondsPutSchema.safeParse({ partnerIds: [2, 3] }).success).toBe(true);
    expect(rabbitBondsPutSchema.safeParse({ partnerIds: [] }).success).toBe(true);
    expect(rabbitBondsPutSchema.safeParse({ partnerIds: [0] }).success).toBe(false);
    expect(rabbitBondsPutSchema.safeParse({ partnerIds: ["2"] }).success).toBe(false);
  });
});

describe("health check validation", () => {
  it("accepts a check with only a weight", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      weightGrams: 2350,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a check with only notes", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      notes: "Eating well",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a check with only a status field", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      appetite: "reduced",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a check with no content", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      notes: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero body condition and out-of-range values", () => {
    expect(
      checkCreateSchema.safeParse({
        rabbitId: 1,
        checkedAt: "2026-05-01T08:30:00.000Z",
        bodyCondition: 0,
      }).success,
    ).toBe(false);
    expect(
      checkCreateSchema.safeParse({
        rabbitId: 1,
        checkedAt: "2026-05-01T08:30:00.000Z",
        bodyCondition: 6,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown status values", () => {
    expect(
      checkCreateSchema.safeParse({
        rabbitId: 1,
        checkedAt: "2026-05-01T08:30:00.000Z",
        appetite: "hungry",
      }).success,
    ).toBe(false);
  });

  it("coerces an ISO timestamp to a Date", () => {
    const result = checkCreateSchema.parse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      weightGrams: 2350,
    });
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it("requires rabbitId and checkedAt", () => {
    expect(checkCreateSchema.safeParse({ checkedAt: "2026-05-01T08:30:00.000Z", notes: "x" }).success).toBe(false);
    expect(checkCreateSchema.safeParse({ rabbitId: 1, notes: "x" }).success).toBe(false);
  });

  it("rejects an empty update patch", () => {
    expect(checkUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(checkUpdateSchema.safeParse({ weightGrams: 2400 }).success).toBe(true);
  });

  it("accepts null to clear a field", () => {
    expect(checkUpdateSchema.safeParse({ weightGrams: null }).success).toBe(true);
  });

  it("accepts a temperature and pain score", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      temperatureTenthsC: 385,
      painScore: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range temperature or pain score", () => {
    expect(
      checkCreateSchema.safeParse({
        rabbitId: 1,
        checkedAt: "2026-05-01T08:30:00.000Z",
        temperatureTenthsC: 999,
      }).success,
    ).toBe(false);
    expect(
      checkCreateSchema.safeParse({
        rabbitId: 1,
        checkedAt: "2026-05-01T08:30:00.000Z",
        painScore: 11,
      }).success,
    ).toBe(false);
  });
});

describe("health checklist validation", () => {
  it("accepts a full checklist payload", () => {
    const result = checklistSchema.safeParse({
      posture: { values: ["hunched"], other: "" },
      demeanour: { values: ["bright"], other: "" },
      eyes: { values: ["watery", "crusty"], other: "" },
      nails: { values: ["other"], other: "split down the middle" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed answers", () => {
    expect(checklistSchema.safeParse({ posture: "hunched" }).success).toBe(false);
    expect(checklistSchema.safeParse({ posture: { values: [1] } }).success).toBe(false);
    expect(checklistSchema.safeParse({ posture: { values: ["ok"], other: 5 } }).success).toBe(false);
  });

  it("accepts a check with a checklist", () => {
    const result = checkCreateSchema.safeParse({
      rabbitId: 1,
      checkedAt: "2026-05-01T08:30:00.000Z",
      weightGrams: 2350,
      checklist: { posture: { values: ["relaxed"], other: "" } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a checklist patch", () => {
    expect(
      checkUpdateSchema.safeParse({ checklist: { hocks: { values: ["bald"], other: "" } } }).success,
    ).toBe(true);
  });
});

describe("vet validation", () => {
  it("requires a name and defaults the optional fields", () => {
    const result = vetCreateSchema.parse({ name: "  Dr. Patel  " });
    expect(result.name).toBe("Dr. Patel");
    expect(result.clinicId).toBeUndefined();
    expect(result.phone).toBe("");
    expect(result.email).toBe("");
    expect(result.address).toBe("");
    expect(result.notes).toBe("");
  });

  it("rejects a blank name", () => {
    expect(vetCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an empty update patch", () => {
    expect(vetUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(vetUpdateSchema.safeParse({ phone: "021 555 0101" }).success).toBe(true);
  });
});

describe("daily check validation", () => {
  it("accepts a check log", () => {
    const result = checkLogCreateSchema.safeParse({
      rabbitId: 1,
      typeId: 2,
      loggedAt: "2026-09-01T08:00:00.000Z",
      valueMilli: 250500,
      valueLabels: ["Binkies", "Exploring"],
      valueText: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("defaults labels to an empty list", () => {
    const result = checkLogCreateSchema.parse({
      rabbitId: 1,
      typeId: 2,
      loggedAt: "2026-09-01T08:00:00.000Z",
    });
    expect(result.valueLabels).toEqual([]);
  });

  it("requires the rabbit, type and time", () => {
    expect(checkLogCreateSchema.safeParse({ rabbitId: 1 }).success).toBe(false);
    expect(
      checkLogCreateSchema.safeParse({ rabbitId: 1, typeId: 2, loggedAt: "not a date" }).success,
    ).toBe(false);
  });

  it("validates check types and their fields", () => {
    const result = checkLogTypeCreateSchema.parse({
      label: "Poo",
      options: ["Normal", "Soft"],
      hasNumber: false,
      multiple: true,
    });
    expect(result.hasNumber).toBe(false);
    expect(result.hasText).toBe(false);
    expect(result.multiple).toBe(true);
    expect(result.options).toEqual(["Normal", "Soft"]);
  });

  it("defaults check types to single-select", () => {
    const result = checkLogTypeCreateSchema.parse({ label: "Water" });
    expect(result.multiple).toBe(false);
  });
});

describe("bowl validation", () => {
  it("accepts a bowl with a start weight", () => {
    const result = bowlCreateSchema.safeParse({
      rabbitId: 1,
      label: "Water bowl",
      startWeightGrams: 850,
      startedAt: "2026-09-01T08:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("requires a name and start weight", () => {
    expect(bowlCreateSchema.safeParse({ rabbitId: 1, startedAt: "2026-09-01T08:00:00.000Z" }).success).toBe(
      false,
    );
    expect(
      bowlCreateSchema.safeParse({
        rabbitId: 1,
        label: "Water bowl",
        startWeightGrams: -1,
        startedAt: "2026-09-01T08:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts bowl times of day and reading slots", () => {
    expect(
      bowlCreateSchema.safeParse({
        rabbitId: 1,
        label: "Water bowl",
        startWeightGrams: 850,
        startedAt: "2026-09-01T08:00:00.000Z",
        slots: ["morning", "evening"],
      }).success,
    ).toBe(true);
    expect(
      bowlCreateSchema.safeParse({
        rabbitId: 1,
        label: "Water bowl",
        startWeightGrams: 850,
        startedAt: "2026-09-01T08:00:00.000Z",
        slots: ["dawn"],
      }).success,
    ).toBe(false);
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "weigh",
        readAt: "2026-09-02T08:00:00.000Z",
        weightGrams: 900,
        slot: "evening",
      }).success,
    ).toBe(true);
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "weigh",
        readAt: "2026-09-02T08:00:00.000Z",
        weightGrams: 900,
        slot: "dawn",
      }).success,
    ).toBe(false);
  });

  it("requires changes on a bowl update", () => {
    expect(bowlUpdateSchema.safeParse({}).success).toBe(false);
    expect(bowlUpdateSchema.safeParse({ slots: ["morning"] }).success).toBe(true);
  });

  it("requires a weight for weigh and refresh readings", () => {
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "weigh",
        readAt: "2026-09-02T08:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "refresh",
        readAt: "2026-09-02T08:00:00.000Z",
        weightGrams: 900,
      }).success,
    ).toBe(true);
  });

  it("requires an amount for a refill", () => {
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "refill",
        readAt: "2026-09-02T08:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      bowlReadingCreateSchema.safeParse({
        kind: "refill",
        readAt: "2026-09-02T08:00:00.000Z",
        refillGrams: 250,
      }).success,
    ).toBe(true);
  });

  it("requires a label when renaming", () => {
    expect(bowlUpdateSchema.safeParse({ label: "  " }).success).toBe(false);
    expect(bowlUpdateSchema.safeParse({ label: "Food bowl" }).success).toBe(true);
  });
});

describe("task validation", () => {
  it("accepts a daily task with defaults", () => {
    const result = taskCreateSchema.parse({ rabbitId: 1, label: "Morning meds" });
    expect(result.slot).toBe("anytime");
    expect(result.intervalDays).toBe(1);
    expect(result.active).toBe(true);
  });

  it("accepts a slot and interval", () => {
    const result = taskCreateSchema.safeParse({
      rabbitId: 1,
      label: "Evening meds",
      slot: "evening",
      intervalDays: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown slot or a bad interval", () => {
    expect(taskCreateSchema.safeParse({ rabbitId: 1, label: "X", slot: "night" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ rabbitId: 1, label: "X", intervalDays: 0 }).success).toBe(false);
  });

  it("requires changes on update", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });

  it("requires a completion time", () => {
    expect(taskCompleteSchema.safeParse({ completedAt: "not a date" }).success).toBe(false);
    expect(taskCompleteSchema.safeParse({ completedAt: "2026-09-15T08:00:00.000Z" }).success).toBe(true);
  });
});

describe("medication log validation", () => {
  it("accepts a dose", () => {
    const result = medicationLogCreateSchema.safeParse({
      rabbitId: 1,
      givenAt: "2026-09-01T08:00:00.000Z",
      amountMilliUnits: 300,
    });
    expect(result.success).toBe(true);
  });

  it("requires a time", () => {
    expect(medicationLogCreateSchema.safeParse({ rabbitId: 1 }).success).toBe(false);
  });

  it("accepts a known slot and rejects an unknown one", () => {
    expect(
      medicationLogCreateSchema.safeParse({
        rabbitId: 1,
        givenAt: "2026-09-01T08:00:00.000Z",
        slot: "morning",
      }).success,
    ).toBe(true);
    expect(
      medicationLogCreateSchema.safeParse({
        rabbitId: 1,
        givenAt: "2026-09-01T08:00:00.000Z",
        slot: "dawn",
      }).success,
    ).toBe(false);
  });

  it("requires at least one change on update", () => {
    expect(medicationLogUpdateSchema.safeParse({}).success).toBe(false);
    expect(medicationLogUpdateSchema.safeParse({ notes: "Corrected" }).success).toBe(true);
    expect(medicationLogUpdateSchema.safeParse({ slot: null }).success).toBe(true);
  });
});

describe("calendar entry validation", () => {
  it("accepts a repeating event", () => {
    const result = calendarEntryCreateSchema.parse({
      title: "Collect hay",
      type: "Hay collection",
      startAt: "2026-09-05T09:00:00.000Z",
      repeat: "weekly",
      repeatUntil: "2026-10-01",
    });
    expect(result.repeat).toBe("weekly");
    expect(result.repeatUntil).toBe("2026-10-01");
    expect(result.allDay).toBe(false);
  });

  it("rejects an unknown repeat", () => {
    expect(
      calendarEntryCreateSchema.safeParse({
        title: "x",
        startAt: "2026-09-05T09:00:00.000Z",
        repeat: "yearly",
      }).success,
    ).toBe(false);
  });

  it("requires a title", () => {
    expect(
      calendarEntryCreateSchema.safeParse({ title: "  ", startAt: "2026-09-05T09:00:00.000Z" }).success,
    ).toBe(false);
  });
});

describe("lookup validation", () => {
  it("requires a known kind and a name", () => {
    expect(lookupCreateSchema.safeParse({ kind: "breed", label: "Rex" }).success).toBe(true);
    expect(lookupCreateSchema.safeParse({ kind: "nope", label: "Rex" }).success).toBe(false);
    expect(lookupCreateSchema.safeParse({ kind: "breed", label: "   " }).success).toBe(false);
  });

  it("accepts interval and cost defaults", () => {
    const result = lookupCreateSchema.parse({
      kind: "vaccine_type",
      label: "RHDV2",
      defaultInt: 365,
    });
    expect(result.defaultInt).toBe(365);
  });

  it("rejects an empty update patch", () => {
    expect(lookupUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("clinic validation", () => {
  it("requires a name and defaults the rest", () => {
    const result = clinicCreateSchema.parse({ name: "Happy Paws" });
    expect(result.name).toBe("Happy Paws");
    expect(result.phone).toBe("");
    expect(result.address).toBe("");
  });

  it("rejects an empty update patch", () => {
    expect(clinicUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("hasCheckContent", () => {
  it("counts a zero weight as content", () => {
    expect(hasCheckContent({ weightGrams: 0 })).toBe(true);
  });

  it("ignores whitespace-only notes", () => {
    expect(hasCheckContent({ notes: "  " })).toBe(false);
  });

  it("detects each content type", () => {
    expect(hasCheckContent({ appetite: "normal" })).toBe(true);
    expect(hasCheckContent({ droppings: "few" })).toBe(true);
    expect(hasCheckContent({ energy: "low" })).toBe(true);
    expect(hasCheckContent({ bodyCondition: 2 })).toBe(true);
    expect(hasCheckContent({ temperatureTenthsC: 385 })).toBe(true);
    expect(hasCheckContent({ painScore: 0 })).toBe(true);
    expect(hasCheckContent({ checklist: { posture: { values: ["relaxed"], other: "" } } })).toBe(true);
    expect(hasCheckContent({})).toBe(false);
  });
});

describe("hasChecklistContent", () => {
  it("detects ticked answers and other text", () => {
    expect(hasChecklistContent(null)).toBe(false);
    expect(hasChecklistContent(undefined)).toBe(false);
    expect(hasChecklistContent({})).toBe(false);
    expect(hasChecklistContent({ posture: { values: [], other: "" } })).toBe(false);
    expect(hasChecklistContent({ posture: { values: ["hunched"], other: "" } })).toBe(true);
    expect(hasChecklistContent({ posture: { values: [], other: "leaning left" } })).toBe(true);
  });
});

describe("validateChecklistAnswers", () => {
  const sections = DEFAULT_CHECKLIST_SECTIONS;

  it("accepts known sections and options", () => {
    expect(
      validateChecklistAnswers({ posture: { values: ["hunched"], other: "" } }, sections),
    ).toBeNull();
    expect(
      validateChecklistAnswers({ nails: { values: ["broken", "splitting"], other: "" } }, sections),
    ).toBeNull();
  });

  it("rejects unknown sections", () => {
    expect(
      validateChecklistAnswers({ flying: { values: ["yes"], other: "" } }, sections),
    ).toContain("Unknown checklist section");
  });

  it("rejects unknown options", () => {
    expect(
      validateChecklistAnswers({ posture: { values: ["flying"], other: "" } }, sections),
    ).toContain("Unknown option");
  });

  it("rejects multiple answers for single-choice sections", () => {
    expect(
      validateChecklistAnswers({ posture: { values: ["hunched", "relaxed"], other: "" } }, sections),
    ).toContain("only one answer");
    expect(
      validateChecklistAnswers({ eyes: { values: ["watery", "crusty"], other: "" } }, sections),
    ).toBeNull();
  });

  it("accepts daily check answers keyed by prefix", () => {
    const dailyTypes = [
      { key: "poo", label: "Poo", multiple: false, hasNumber: false, hasText: false, options: ["Normal", "Soft"] },
      { key: "water", label: "Water", multiple: false, hasNumber: true, hasText: false, options: [] },
      {
        key: "behaviour",
        label: "Behaviour",
        multiple: true,
        hasNumber: false,
        hasText: false,
        options: ["Binkies", "Exploring"],
      },
    ];
    expect(
      validateChecklistAnswers(
        {
          "daily:poo": { values: ["Normal"], other: "" },
          "daily:water": { values: [], other: "", numberMilli: 250000 },
          "daily:behaviour": { values: ["Binkies", "Exploring"], other: "" },
        },
        sections,
        dailyTypes,
      ),
    ).toBeNull();
  });

  it("rejects unknown daily types and mismatched values", () => {
    const dailyTypes = [
      { key: "poo", label: "Poo", multiple: false, hasNumber: false, hasText: false, options: ["Normal"] },
      { key: "water", label: "Water", multiple: false, hasNumber: true, hasText: false, options: [] },
    ];
    expect(
      validateChecklistAnswers({ "daily:food": { values: ["Hay"], other: "" } }, sections, dailyTypes),
    ).toContain("Unknown daily check");
    expect(
      validateChecklistAnswers({ "daily:poo": { values: ["Soft"], other: "" } }, sections, dailyTypes),
    ).toContain("Unknown option");
    expect(
      validateChecklistAnswers({ "daily:poo": { values: [], other: "", numberMilli: 5 } }, sections, dailyTypes),
    ).toContain("does not take an amount");
    expect(
      validateChecklistAnswers({ "daily:water": { values: [], other: "", text: "lots" } }, sections, dailyTypes),
    ).toContain("does not take text");
    expect(
      validateChecklistAnswers({ "daily:water": { values: ["500"], other: "" } }, sections, dailyTypes),
    ).toContain("does not take options");
    expect(
      validateChecklistAnswers(
        { "daily:poo": { values: ["Normal", "Normal"], other: "" } },
        sections,
        dailyTypes,
      ),
    ).toContain("only one answer");
  });

  it("rejects amount and text fields on plain checklist sections", () => {
    expect(
      validateChecklistAnswers({ posture: { values: [], other: "", numberMilli: 5 } }, sections),
    ).toContain("Unexpected value");
    expect(
      validateChecklistAnswers({ posture: { values: [], other: "", text: "fine" } }, sections),
    ).toContain("Unexpected value");
  });
});

describe("checklistSchema daily answers", () => {
  it("accepts amounts and text", () => {
    const result = checklistSchema.safeParse({
      "daily:water": { values: [], other: "", numberMilli: 250000 },
      "daily:food": { values: [], other: "", text: "Ate well" },
    });
    expect(result.success).toBe(true);
  });
});

describe("slugifyLabel", () => {
  it("builds stable slugs", () => {
    expect(slugifyLabel("Body condition (1-5)")).toBe("body_condition_1_5");
    expect(slugifyLabel("  Teeth!  ")).toBe("teeth");
    expect(slugifyLabel("!!!")).toBe("item");
  });
});

describe("treatment validation", () => {
  it("accepts a minimal treatment and applies defaults", () => {
    const result = treatmentCreateSchema.parse({
      rabbitId: 1,
      medication: "Meloxicam",
      startDate: "2026-05-01",
    });
    expect(result).toMatchObject({
      dose: "",
      route: "",
      frequency: "",
      reason: "",
      status: "active",
      notes: "",
    });
    expect(result.endDate).toBeUndefined();
  });

  it("requires a medication name", () => {
    expect(
      treatmentCreateSchema.safeParse({ rabbitId: 1, medication: "  ", startDate: "2026-05-01" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      treatmentCreateSchema.safeParse({
        rabbitId: 1,
        medication: "Meloxicam",
        startDate: "2026-05-01",
        status: "paused",
      }).success,
    ).toBe(false);
  });

  it("clears the end date with an empty string", () => {
    const result = treatmentCreateSchema.parse({
      rabbitId: 1,
      medication: "Meloxicam",
      startDate: "2026-05-01",
      endDate: "",
    });
    expect(result.endDate).toBeNull();
  });

  it("rejects a malformed start date", () => {
    expect(
      treatmentCreateSchema.safeParse({ rabbitId: 1, medication: "Meloxicam", startDate: "01/05/2026" })
        .success,
    ).toBe(false);
  });

  it("defaults to no time slots and accepts known slots", () => {
    const defaults = treatmentCreateSchema.parse({
      rabbitId: 1,
      medication: "Meloxicam",
      startDate: "2026-05-01",
    });
    expect(defaults.slots).toEqual([]);
    const result = treatmentCreateSchema.parse({
      rabbitId: 1,
      medication: "Meloxicam",
      startDate: "2026-05-01",
      slots: ["early_morning", "evening"],
    });
    expect(result.slots).toEqual(["early_morning", "evening"]);
  });

  it("rejects unknown time slots", () => {
    expect(
      treatmentCreateSchema.safeParse({
        rabbitId: 1,
        medication: "Meloxicam",
        startDate: "2026-05-01",
        slots: ["dawn"],
      }).success,
    ).toBe(false);
  });
});

describe("vaccination validation", () => {
  it("accepts a minimal vaccination", () => {
    const result = vaccinationCreateSchema.parse({
      rabbitId: 1,
      vaccine: "RHDV2",
      givenAt: "2026-03-01",
    });
    expect(result.nextDueAt).toBeUndefined();
    expect(result.vet).toBe("");
  });

  it("accepts a custom vaccine name from the vaccine-type list", () => {
    expect(
      vaccinationCreateSchema.safeParse({ rabbitId: 1, vaccine: "Rabies", givenAt: "2026-03-01" })
        .success,
    ).toBe(true);
    expect(
      vaccinationCreateSchema.safeParse({ rabbitId: 1, vaccine: "  ", givenAt: "2026-03-01" })
        .success,
    ).toBe(false);
  });

  it("requires a given date", () => {
    expect(vaccinationCreateSchema.safeParse({ rabbitId: 1, vaccine: "Other" }).success).toBe(false);
  });
});

describe("care validation", () => {
  it("accepts a valid schedule", () => {
    expect(careSchedulePutSchema.safeParse({ kind: "nails", intervalDays: 42 }).success).toBe(true);
  });

  it("rejects non-positive and absurd intervals", () => {
    expect(careSchedulePutSchema.safeParse({ kind: "nails", intervalDays: 0 }).success).toBe(false);
    expect(careSchedulePutSchema.safeParse({ kind: "nails", intervalDays: 4000 }).success).toBe(false);
  });

  it("accepts a custom care type (checked against the list in the route)", () => {
    expect(careSchedulePutSchema.safeParse({ kind: "bath", intervalDays: 30 }).success).toBe(true);
    expect(careSchedulePutSchema.safeParse({ kind: " ", intervalDays: 30 }).success).toBe(false);
  });

  it("accepts a care record and defaults notes", () => {
    const result = careRecordCreateSchema.parse({
      rabbitId: 1,
      kind: "grooming",
      doneAt: "2026-06-01",
    });
    expect(result.notes).toBe("");
  });
});

describe("appointment validation", () => {
  it("accepts a minimal appointment and applies defaults", () => {
    const result = appointmentCreateSchema.parse({
      rabbitId: 1,
      title: "Annual check",
      scheduledAt: "2026-07-01T02:00:00.000Z",
    });
    expect(result).toMatchObject({
      clinic: "",
      vet: "",
      location: "",
      status: "scheduled",
      notes: "",
    });
    expect(result.scheduledAt).toBeInstanceOf(Date);
    expect(result.costCents).toBeUndefined();
    expect(result.followUpAt).toBeUndefined();
  });

  it("requires a title and a scheduled time", () => {
    expect(appointmentCreateSchema.safeParse({ rabbitId: 1, title: " " }).success).toBe(false);
    expect(
      appointmentCreateSchema.safeParse({ rabbitId: 1, scheduledAt: "2026-07-01T02:00:00.000Z" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      appointmentCreateSchema.safeParse({
        rabbitId: 1,
        title: "Check",
        scheduledAt: "2026-07-01T02:00:00.000Z",
        status: "missed",
      }).success,
    ).toBe(false);
  });

  it("accepts a cost in cents", () => {
    const result = appointmentCreateSchema.parse({
      rabbitId: 1,
      title: "Check",
      scheduledAt: "2026-07-01T02:00:00.000Z",
      costCents: 12500,
    });
    expect(result.costCents).toBe(12500);
  });

  it("clears a follow-up with an empty string", () => {
    const result = appointmentCreateSchema.parse({
      rabbitId: 1,
      title: "Check",
      scheduledAt: "2026-07-01T02:00:00.000Z",
      followUpAt: "",
    });
    expect(result.followUpAt).toBeNull();
  });

  it("clears a follow-up with null instead of the epoch", () => {
    const created = appointmentCreateSchema.parse({
      rabbitId: 1,
      title: "Check",
      scheduledAt: "2026-07-01T02:00:00.000Z",
      followUpAt: null,
    });
    expect(created.followUpAt).toBeNull();
    const updated = appointmentUpdateSchema.parse({ followUpAt: null });
    expect(updated.followUpAt).toBeNull();
  });

  it("rejects an empty update patch", () => {
    expect(appointmentUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(appointmentUpdateSchema.safeParse({ status: "completed" }).success).toBe(true);
  });
});

describe("faq validation", () => {
  it("accepts a valid entry", () => {
    const result = faqCreateSchema.parse({
      category: " Diet ",
      question: " What should my rabbit eat? ",
      answer: " Mostly hay. ",
    });
    expect(result).toEqual({
      category: "Diet",
      question: "What should my rabbit eat?",
      answer: "Mostly hay.",
    });
  });

  it("rejects blank fields", () => {
    expect(faqCreateSchema.safeParse({ category: "Diet", question: " ", answer: "x" }).success).toBe(false);
    expect(faqCreateSchema.safeParse({ category: " ", question: "Q", answer: "x" }).success).toBe(false);
    expect(faqCreateSchema.safeParse({ category: "Diet", question: "Q", answer: " " }).success).toBe(false);
  });

  it("rejects an empty update patch", () => {
    expect(faqUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(faqUpdateSchema.safeParse({ question: "New question?" }).success).toBe(true);
  });

  it("requires at least one id to reorder", () => {
    expect(faqReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(faqReorderSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
  });

  it("rejects non-positive ids", () => {
    expect(faqReorderSchema.safeParse({ ids: [0] }).success).toBe(false);
    expect(faqReorderSchema.safeParse({ ids: [-1] }).success).toBe(false);
  });
});
