import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  appointments,
  bowlReadings,
  bowls,
  careRecords,
  careSchedules,
  checkLogs,
  checkLogTypes,
  clinics,
  drugs,
  healthChecks,
  journalEntries,
  medicationLogs,
  rabbitBonds,
  rabbitCarers,
  rabbits,
  rabbitTasks,
  settings,
  taskCompletions,
  treatments,
  users,
  vaccinations,
  vets,
} from "../db/schema.ts";
import type { HealthChecklistDto } from "../../../shared/checklist.ts";
import type { CareKind, Vaccine } from "../../../shared/types.ts";
import { deletePhotoDir } from "../services/photos.ts";
import { ensureSettingsRow } from "./settingsStore.ts";

type DemoRabbit = {
  name: string;
  sex: "male" | "female";
  breed: string;
  colour: string;
  dateOfBirth: string;
  desexed: boolean;
  microchip: string;
  notes: string;
  targetWeightMinGrams: number;
  targetWeightMaxGrams: number;
  feedingPlan: string;
  quarantined: boolean;
  quarantineUntil: string | null;
};

type DemoCheck = {
  rabbitIndex: number;
  checkedAt: Date;
  weightGrams: number;
  appetite: "normal" | "reduced" | "none";
  droppings: "normal" | "small" | "few" | "none";
  energy: "normal" | "low" | "high";
  bodyCondition: number;
  temperatureTenthsC: number | null;
  painScore: number | null;
  checklist: HealthChecklistDto | null;
  notes: string;
};

type DemoTreatment = {
  rabbitIndex: number;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  reason: string;
  startDate: string;
  endDate: string | null;
  status: "active" | "completed" | "stopped";
  notes: string;
};

type DemoVaccination = {
  rabbitIndex: number;
  vaccine: Vaccine;
  givenAt: string;
  nextDueAt: string;
  vet: string;
  batch: string;
  notes: string;
};

type DemoCareSchedule = {
  rabbitIndex: number;
  kind: CareKind;
  intervalDays: number;
};

type DemoCareRecord = {
  rabbitIndex: number;
  kind: CareKind;
  doneAt: string;
  notes: string;
};

type DemoAppointment = {
  rabbitIndex: number;
  title: string;
  clinic: string;
  vet: string;
  location: string;
  scheduledAt: Date;
  status: "scheduled" | "completed" | "cancelled";
  costCents: number | null;
  followUpAt: Date | null;
  notes: string;
};

type DemoJournalEntry = {
  rabbitIndex: number;
  daysAgo: number;
  note: string;
};

type DemoCheckLog = {
  rabbitIndex: number;
  typeKey: string;
  hoursAgo: number;
  valueLabels: string[];
  valueMilli: number | null;
  valueText: string;
  notes: string;
};

type DemoMedicationLog = {
  rabbitIndex: number;
  treatmentIndex: number;
  hoursAgo: number;
  amountMilliUnits: number;
  notes: string;
};

type DemoBowlReading = {
  hoursAgo: number;
  kind: "start" | "weigh" | "refill" | "refresh";
  weightGrams: number;
  notes: string;
};

type DemoBowl = {
  rabbitIndex: number;
  label: string;
  readings: DemoBowlReading[];
};

type DemoTask = {
  rabbitIndex: number;
  label: string;
  slot: "morning" | "afternoon" | "evening" | "anytime";
  intervalDays: number;
  notes: string;
  active: boolean;
  completionsHoursAgo: number[];
};

export type DemoDataset = {
  rabbits: DemoRabbit[];
  checks: DemoCheck[];
  treatments: DemoTreatment[];
  vaccinations: DemoVaccination[];
  careSchedules: DemoCareSchedule[];
  careRecords: DemoCareRecord[];
  appointments: DemoAppointment[];
  journal: DemoJournalEntry[];
  checkLogs: DemoCheckLog[];
  medicationLogs: DemoMedicationLog[];
  bowls: DemoBowl[];
  tasks: DemoTask[];
  bonds: { a: number; b: number }[];
  clinic: { name: string; phone: string; email: string; address: string; notes: string };
  vet: { name: string; phone: string; email: string; notes: string };
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateOnly(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthDay(now: Date, day: number, hour: number, minute: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

export function buildDemoDataset(now: Date): DemoDataset {
  const dob = (years: number, months: number) => {
    const date = new Date(now.getFullYear() - years, now.getMonth() - months, 15);
    return dateOnly(date);
  };

  const rabbits: DemoRabbit[] = [
    {
      name: "Clover",
      sex: "female",
      breed: "Lionhead",
      colour: "White",
      dateOfBirth: dob(2, 6),
      desexed: true,
      microchip: "985141000000001",
      notes: "Loves parsley. Bonded with Biscuit.",
      targetWeightMinGrams: 2200,
      targetWeightMaxGrams: 2500,
      feedingPlan: "Unlimited hay. 1/4 cup pellets morning and night. Parsley as a treat.",
      quarantined: false,
      quarantineUntil: null,
    },
    {
      name: "Biscuit",
      sex: "male",
      breed: "Mini Lop",
      colour: "Grey",
      dateOfBirth: dob(1, 8),
      desexed: true,
      microchip: "985141000000002",
      notes: "Nervous at the vet. Hides under the hutch when it rains.",
      targetWeightMinGrams: 1700,
      targetWeightMaxGrams: 1950,
      feedingPlan: "Unlimited hay. 1/4 cup pellets. Spring greens daily.",
      quarantined: false,
      quarantineUntil: null,
    },
    {
      name: "Pepper",
      sex: "female",
      breed: "Netherland Dwarf",
      colour: "Black",
      dateOfBirth: dob(4, 1),
      desexed: true,
      microchip: "985141000000003",
      notes: "Senior bunny. Needs her teeth checked regularly.",
      targetWeightMinGrams: 2050,
      targetWeightMaxGrams: 2250,
      feedingPlan: "Unlimited hay. 2 tbsp pellets (senior). Soft greens only.",
      quarantined: true,
      quarantineUntil: dateOnly(addDays(now, 10)),
    },
  ];

  const checkPlan = [
    { weights: [2450, 2440, 2430, 2420, 2400, 2380, 2370, 2240], appetite: "reduced" as const },
    { weights: [1800, 1805, 1810, 1800, 1815, 1820, 1815, 1825], appetite: "normal" as const },
    { weights: [2100, 2110, 2120, 2130, 2140, 2150, 2160, 2170], appetite: "normal" as const },
  ];
  const checklistFor = (rabbitIndex: number): HealthChecklistDto => {
    if (rabbitIndex === 0) {
      return {
        posture: { values: ["hunched"], other: "" },
        demeanour: { values: ["quiet"], other: "" },
        eyes: { values: ["bright_normal"], other: "" },
        respiratory: { values: ["normal"], other: "" },
        coatSkin: { values: ["dull_scruffy"], other: "" },
        behaviour: { values: ["quiet"], other: "" },
        bum: { values: ["normal"], other: "" },
        ears: { values: ["clean"], other: "" },
        nails: { values: ["clipping_soon"], other: "" },
        genitals: { values: ["normal"], other: "" },
        hocks: { values: ["normal"], other: "" },
      };
    }
    if (rabbitIndex === 2) {
      return {
        posture: { values: ["relaxed"], other: "" },
        demeanour: { values: ["bright"], other: "" },
        eyes: { values: ["watery"], other: "Left eye slightly weepy" },
        respiratory: { values: ["normal"], other: "" },
        coatSkin: { values: ["soft_shiny"], other: "" },
        behaviour: { values: ["friendly"], other: "" },
        bum: { values: ["normal"], other: "" },
        ears: { values: ["excess_wax"], other: "" },
        nails: { values: ["short"], other: "" },
        genitals: { values: ["normal"], other: "" },
        hocks: { values: ["red_sore"], other: "" },
      };
    }
    return {
      posture: { values: ["relaxed"], other: "" },
      demeanour: { values: ["bright"], other: "" },
      eyes: { values: ["bright_normal"], other: "" },
      respiratory: { values: ["normal"], other: "" },
      coatSkin: { values: ["soft_shiny"], other: "" },
      behaviour: { values: ["friendly"], other: "" },
      bum: { values: ["normal"], other: "" },
      ears: { values: ["clean"], other: "" },
      nails: { values: ["short"], other: "" },
      genitals: { values: ["normal"], other: "" },
      hocks: { values: ["normal"], other: "" },
    };
  };

  const checks: DemoCheck[] = [];
  checkPlan.forEach((plan, rabbitIndex) => {
    plan.weights.forEach((weightGrams, index) => {
      const weeksAgo = plan.weights.length - 1 - index;
      const latest = index === plan.weights.length - 1;
      checks.push({
        rabbitIndex,
        checkedAt: addDays(now, -weeksAgo * 7),
        weightGrams,
        appetite: latest ? plan.appetite : "normal",
        droppings: "normal",
        energy: latest && rabbitIndex === 0 ? "low" : "normal",
        bodyCondition: latest && rabbitIndex === 0 ? 2 : 3,
        temperatureTenthsC: latest ? (rabbitIndex === 0 ? 392 : 385) : null,
        painScore: latest ? (rabbitIndex === 0 ? 4 : 0) : null,
        checklist: latest ? checklistFor(rabbitIndex) : null,
        notes:
          latest && rabbitIndex === 0 ? "Eating less than usual and quieter than normal." : "",
      });
    });
  });

  const treatments: DemoTreatment[] = [
    {
      rabbitIndex: 0,
      medication: "Meloxicam",
      dose: "0.3 ml",
      route: "Oral",
      frequency: "Once daily",
      reason: "Post-op pain",
      startDate: dateOnly(addDays(now, -5)),
      endDate: dateOnly(addDays(now, 5)),
      status: "active",
      notes: "Give with food.",
    },
    {
      rabbitIndex: 1,
      medication: "Baytril",
      dose: "0.5 ml",
      route: "Oral",
      frequency: "Twice daily",
      reason: "Infection",
      startDate: dateOnly(addDays(now, -60)),
      endDate: dateOnly(addDays(now, -50)),
      status: "completed",
      notes: "",
    },
  ];

  const vaccinations: DemoVaccination[] = [
    {
      rabbitIndex: 0,
      vaccine: "RHDV2",
      givenAt: dateOnly(addDays(now, -355)),
      nextDueAt: dateOnly(addDays(now, 10)),
      vet: "Dr. Patel",
      batch: "RHD-4412",
      notes: "",
    },
    {
      rabbitIndex: 1,
      vaccine: "RHDV2",
      givenAt: dateOnly(addDays(now, -180)),
      nextDueAt: dateOnly(addDays(now, 185)),
      vet: "Dr. Patel",
      batch: "RHD-4501",
      notes: "",
    },
    {
      rabbitIndex: 1,
      vaccine: "Myxomatosis",
      givenAt: dateOnly(addDays(now, -170)),
      nextDueAt: dateOnly(addDays(now, 195)),
      vet: "Dr. Patel",
      batch: "MYX-1180",
      notes: "",
    },
    {
      rabbitIndex: 2,
      vaccine: "RHDV2",
      givenAt: dateOnly(addDays(now, -370)),
      nextDueAt: dateOnly(addDays(now, -5)),
      vet: "Dr. Patel",
      batch: "RHD-3980",
      notes: "Booked for the overdue booster.",
    },
  ];

  const careSchedules: DemoCareSchedule[] = [
    { rabbitIndex: 0, kind: "nails", intervalDays: 30 },
    { rabbitIndex: 0, kind: "teeth", intervalDays: 90 },
    { rabbitIndex: 0, kind: "grooming", intervalDays: 60 },
    { rabbitIndex: 1, kind: "nails", intervalDays: 42 },
    { rabbitIndex: 2, kind: "teeth", intervalDays: 180 },
    { rabbitIndex: 2, kind: "grooming", intervalDays: 60 },
  ];

  const careRecords: DemoCareRecord[] = [
    { rabbitIndex: 0, kind: "nails", doneAt: dateOnly(addDays(now, -40)), notes: "" },
    { rabbitIndex: 0, kind: "teeth", doneAt: dateOnly(addDays(now, -20)), notes: "No spurs." },
    { rabbitIndex: 0, kind: "grooming", doneAt: dateOnly(addDays(now, -55)), notes: "" },
    { rabbitIndex: 1, kind: "nails", doneAt: dateOnly(addDays(now, -38)), notes: "" },
    { rabbitIndex: 2, kind: "teeth", doneAt: dateOnly(addDays(now, -100)), notes: "" },
    { rabbitIndex: 2, kind: "grooming", doneAt: dateOnly(addDays(now, -20)), notes: "" },
  ];

  const monthAppointments: { day: number; rabbitIndex: number; title: string; costCents: number }[] = [
    { day: 5, rabbitIndex: 0, title: "Post-op check", costCents: 8500 },
    { day: 11, rabbitIndex: 1, title: "Vaccination booster", costCents: 12500 },
    { day: 17, rabbitIndex: 2, title: "Dental check", costCents: 9500 },
    { day: 23, rabbitIndex: 0, title: "Nail trim", costCents: 2500 },
  ];
  const appointments: DemoAppointment[] = monthAppointments.map((item) => {
    const scheduledAt = monthDay(now, item.day, 12, 0);
    return {
      rabbitIndex: item.rabbitIndex,
      title: item.title,
      clinic: "Happy Paws Vet Clinic",
      vet: "Dr. Patel",
      location: "Clinic",
      scheduledAt,
      status: scheduledAt.getTime() < now.getTime() ? "completed" : "scheduled",
      costCents: scheduledAt.getTime() < now.getTime() ? item.costCents : null,
      followUpAt: null,
      notes: "",
    };
  });

  const upcoming = addDays(now, 5);
  appointments.push({
    rabbitIndex: 2,
    title: "Booster vaccination",
    clinic: "Happy Paws Vet Clinic",
    vet: "Dr. Patel",
    location: "Clinic",
    scheduledAt: new Date(upcoming.getFullYear(), upcoming.getMonth(), upcoming.getDate(), 15, 30),
    status: "scheduled",
    costCents: null,
    followUpAt: addDays(now, -2),
    notes: "Bring the vaccination record.",
  });

  const journal: DemoJournalEntry[] = [
    { rabbitIndex: 0, daysAgo: 2, note: "Clover ate all her greens today and was much brighter after the pain relief." },
    { rabbitIndex: 0, daysAgo: 12, note: "First day home after the dental. Kept her quiet and warm." },
    { rabbitIndex: 1, daysAgo: 4, note: "Biscuit binkied across the lounge — feeling good!" },
    { rabbitIndex: 2, daysAgo: 6, note: "Pepper is isolating after the mite treatment. Weigh-in on Friday." },
  ];

  const checkLogs: DemoCheckLog[] = [
    {
      rabbitIndex: 0,
      typeKey: "poo",
      hoursAgo: 2,
      valueLabels: ["Soft"],
      valueMilli: null,
      valueText: "",
      notes: "Smaller than usual.",
    },
    {
      rabbitIndex: 0,
      typeKey: "behaviour",
      hoursAgo: 26,
      valueLabels: ["Quiet", "Hiding"],
      valueMilli: null,
      valueText: "",
      notes: "Settled after the evening dose.",
    },
    {
      rabbitIndex: 0,
      typeKey: "poo",
      hoursAgo: 50,
      valueLabels: ["Normal"],
      valueMilli: null,
      valueText: "",
      notes: "",
    },
    {
      rabbitIndex: 0,
      typeKey: "behaviour",
      hoursAgo: 74,
      valueLabels: ["Flopped", "Comfortable"],
      valueMilli: null,
      valueText: "",
      notes: "Relaxed in the run.",
    },
    {
      rabbitIndex: 1,
      typeKey: "poo",
      hoursAgo: 3,
      valueLabels: ["Normal"],
      valueMilli: null,
      valueText: "",
      notes: "",
    },
    {
      rabbitIndex: 1,
      typeKey: "behaviour",
      hoursAgo: 8,
      valueLabels: ["Binkies", "Active"],
      valueMilli: null,
      valueText: "",
      notes: "Zoomies around the lounge.",
    },
    {
      rabbitIndex: 1,
      typeKey: "poo",
      hoursAgo: 27,
      valueLabels: ["Soft"],
      valueMilli: null,
      valueText: "",
      notes: "Watching after the new hay.",
    },
    {
      rabbitIndex: 2,
      typeKey: "poo",
      hoursAgo: 52,
      valueLabels: ["Small"],
      valueMilli: null,
      valueText: "",
      notes: "",
    },
    {
      rabbitIndex: 2,
      typeKey: "behaviour",
      hoursAgo: 100,
      valueLabels: ["Hiding", "Quiet"],
      valueMilli: null,
      valueText: "",
      notes: "Still settling after the move.",
    },
    {
      rabbitIndex: 2,
      typeKey: "poo",
      hoursAgo: 76,
      valueLabels: ["Normal"],
      valueMilli: null,
      valueText: "",
      notes: "Back to normal after the mite treatment.",
    },
  ];

  const medicationLogs: DemoMedicationLog[] = [26, 50, 74, 98].map((hours, index) => ({
    rabbitIndex: 0,
    treatmentIndex: 0,
    hoursAgo: hours,
    amountMilliUnits: 300,
    notes: index === 0 ? "Gave with food." : "",
  }));

  const bowls: DemoBowl[] = [
    {
      rabbitIndex: 0,
      label: "Water bowl",
      readings: [
        { hoursAgo: 72, kind: "start", weightGrams: 900, notes: "" },
        { hoursAgo: 48, kind: "weigh", weightGrams: 650, notes: "" },
        { hoursAgo: 24, kind: "weigh", weightGrams: 400, notes: "Drinking well." },
        { hoursAgo: 20, kind: "refill", weightGrams: 950, notes: "" },
        { hoursAgo: 4, kind: "weigh", weightGrams: 800, notes: "" },
      ],
    },
    {
      rabbitIndex: 1,
      label: "Pellets bowl",
      readings: [
        { hoursAgo: 96, kind: "start", weightGrams: 300, notes: "" },
        { hoursAgo: 72, kind: "weigh", weightGrams: 150, notes: "" },
        { hoursAgo: 70, kind: "refill", weightGrams: 320, notes: "" },
        { hoursAgo: 24, kind: "weigh", weightGrams: 80, notes: "" },
        { hoursAgo: 6, kind: "refresh", weightGrams: 300, notes: "Washed and refilled." },
      ],
    },
    {
      rabbitIndex: 2,
      label: "Food bowl",
      readings: [
        { hoursAgo: 120, kind: "start", weightGrams: 500, notes: "" },
        { hoursAgo: 96, kind: "weigh", weightGrams: 380, notes: "" },
        { hoursAgo: 72, kind: "weigh", weightGrams: 250, notes: "Eating less." },
        { hoursAgo: 68, kind: "refill", weightGrams: 520, notes: "" },
        { hoursAgo: 24, kind: "weigh", weightGrams: 300, notes: "" },
      ],
    },
  ];

  const tasks: DemoTask[] = [
    {
      rabbitIndex: 0,
      label: "Evening meds check",
      slot: "evening",
      intervalDays: 1,
      notes: "Give with food.",
      active: true,
      completionsHoursAgo: [26, 50, 74, 98],
    },
    {
      rabbitIndex: 1,
      label: "Clean litter tray",
      slot: "morning",
      intervalDays: 3,
      notes: "",
      active: true,
      completionsHoursAgo: [30],
    },
    {
      rabbitIndex: 2,
      label: "Weigh Pepper",
      slot: "anytime",
      intervalDays: 7,
      notes: "Senior check.",
      active: true,
      completionsHoursAgo: [100],
    },
    {
      rabbitIndex: 2,
      label: "Nail check",
      slot: "afternoon",
      intervalDays: 30,
      notes: "Paused while in quarantine.",
      active: false,
      completionsHoursAgo: [],
    },
  ];

  const bonds = [{ a: 0, b: 1 }];

  return {
    rabbits,
    checks,
    treatments,
    vaccinations,
    careSchedules,
    careRecords,
    appointments,
    journal,
    checkLogs,
    medicationLogs,
    bowls,
    tasks,
    bonds,
    clinic: {
      name: "Happy Paws Vet Clinic",
      phone: "09 555 0101",
      email: "hello@happypaws.example",
      address: "12 Main Street",
      notes: "Rabbit-savvy team. Open Saturday mornings.",
    },
    vet: {
      name: "Dr. Patel",
      phone: "09 555 0101",
      email: "patel@happypaws.example",
      notes: "Special interest in rabbit dentistry.",
    },
  };
}

export async function enableDemoData(): Promise<void> {
  await ensureSettingsRow();
  const rows = await db.select().from(settings).limit(1);
  if (rows[0]?.demoMode) return;

  const dataset = buildDemoDataset(new Date());
  await db.transaction(async (tx) => {
    const workerRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.active, true), eq(users.isAdmin, false)));

    const [clinic] = await tx
      .insert(clinics)
      .values({ ...dataset.clinic, isDemo: true })
      .returning({ id: clinics.id });
    const [vet] = await tx
      .insert(vets)
      .values({ ...dataset.vet, clinicId: clinic.id, isDemo: true })
      .returning({ id: vets.id });

    const inserted = await tx
      .insert(rabbits)
      .values(dataset.rabbits.map((rabbit) => ({ ...rabbit, isDemo: true })))
      .returning({ id: rabbits.id });
    const rabbitIds = inserted.map((row) => row.id);

    if (dataset.checks.length > 0) {
      await tx.insert(healthChecks).values(
        dataset.checks.map((check) => ({
          rabbitId: rabbitIds[check.rabbitIndex],
          checkedAt: check.checkedAt,
          weightGrams: check.weightGrams,
          appetite: check.appetite,
          droppings: check.droppings,
          energy: check.energy,
          bodyCondition: check.bodyCondition,
          temperatureTenthsC: check.temperatureTenthsC,
          painScore: check.painScore,
          checklist: check.checklist,
          notes: check.notes,
        })),
      );
    }
    let treatmentIds: number[] = [];
    if (dataset.treatments.length > 0) {
      const insertedTreatments = await tx
        .insert(treatments)
        .values(
          dataset.treatments.map((treatment) => ({
            rabbitId: rabbitIds[treatment.rabbitIndex],
            medication: treatment.medication,
            dose: treatment.dose,
            route: treatment.route,
            frequency: treatment.frequency,
            reason: treatment.reason,
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            status: treatment.status,
            notes: treatment.notes,
          })),
        )
        .returning({ id: treatments.id });
      treatmentIds = insertedTreatments.map((row) => row.id);
    }
    if (dataset.vaccinations.length > 0) {
      await tx.insert(vaccinations).values(
        dataset.vaccinations.map((vaccination) => ({
          rabbitId: rabbitIds[vaccination.rabbitIndex],
          vaccine: vaccination.vaccine,
          givenAt: vaccination.givenAt,
          nextDueAt: vaccination.nextDueAt,
          vet: vaccination.vet,
          batch: vaccination.batch,
          notes: vaccination.notes,
        })),
      );
    }
    if (dataset.careSchedules.length > 0) {
      await tx.insert(careSchedules).values(
        dataset.careSchedules.map((schedule) => ({
          rabbitId: rabbitIds[schedule.rabbitIndex],
          kind: schedule.kind,
          intervalDays: schedule.intervalDays,
        })),
      );
    }
    if (dataset.careRecords.length > 0) {
      await tx.insert(careRecords).values(
        dataset.careRecords.map((record) => ({
          rabbitId: rabbitIds[record.rabbitIndex],
          kind: record.kind,
          doneAt: record.doneAt,
          notes: record.notes,
        })),
      );
    }
    if (dataset.appointments.length > 0) {
      await tx.insert(appointments).values(
        dataset.appointments.map((appointment) => ({
          rabbitId: rabbitIds[appointment.rabbitIndex],
          title: appointment.title,
          clinic: appointment.clinic,
          vet: appointment.vet,
          location: appointment.location,
          scheduledAt: appointment.scheduledAt,
          status: appointment.status,
          costCents: appointment.costCents,
          followUpAt: appointment.followUpAt,
          notes: appointment.notes,
        })),
      );
    }
    if (dataset.journal.length > 0) {
      await tx.insert(journalEntries).values(
        dataset.journal.map((entry) => ({
          rabbitId: rabbitIds[entry.rabbitIndex],
          note: entry.note,
          createdAt: addDays(new Date(), -entry.daysAgo),
        })),
      );
    }
    if (dataset.checkLogs.length > 0) {
      const typeRows = await tx
        .select({ id: checkLogTypes.id, key: checkLogTypes.key })
        .from(checkLogTypes);
      const typeByKey = new Map(typeRows.map((row) => [row.key, row.id]));
      const values: (typeof checkLogs.$inferInsert)[] = [];
      for (const log of dataset.checkLogs) {
        const typeId = typeByKey.get(log.typeKey);
        if (!typeId) continue;
        values.push({
          rabbitId: rabbitIds[log.rabbitIndex],
          typeId,
          loggedAt: hoursAgo(log.hoursAgo),
          valueLabels: log.valueLabels,
          valueMilli: log.valueMilli,
          valueText: log.valueText,
          notes: log.notes,
        });
      }
      if (values.length > 0) await tx.insert(checkLogs).values(values);
    }
    if (dataset.medicationLogs.length > 0) {
      const [drug] = await tx
        .select({ id: drugs.id })
        .from(drugs)
        .where(eq(drugs.activeIngredient, "meloxicam"))
        .limit(1);
      await tx.insert(medicationLogs).values(
        dataset.medicationLogs.map((log) => ({
          rabbitId: rabbitIds[log.rabbitIndex],
          treatmentId: treatmentIds[log.treatmentIndex] ?? null,
          drugId: drug?.id ?? null,
          givenAt: hoursAgo(log.hoursAgo),
          amountMilliUnits: log.amountMilliUnits,
          notes: log.notes,
        })),
      );
    }
    if (dataset.bowls.length > 0) {
      for (const bowl of dataset.bowls) {
        const [bowlRow] = await tx
          .insert(bowls)
          .values({ rabbitId: rabbitIds[bowl.rabbitIndex], label: bowl.label })
          .returning({ id: bowls.id });
        await tx.insert(bowlReadings).values(
          bowl.readings.map((reading) => ({
            bowlId: bowlRow.id,
            readAt: hoursAgo(reading.hoursAgo),
            kind: reading.kind,
            weightGrams: reading.weightGrams,
            notes: reading.notes,
          })),
        );
      }
    }
    if (dataset.tasks.length > 0) {
      for (const task of dataset.tasks) {
        const [taskRow] = await tx
          .insert(rabbitTasks)
          .values({
            rabbitId: rabbitIds[task.rabbitIndex],
            label: task.label,
            slot: task.slot,
            intervalDays: task.intervalDays,
            notes: task.notes,
            active: task.active,
          })
          .returning({ id: rabbitTasks.id });
        if (task.completionsHoursAgo.length > 0) {
          await tx.insert(taskCompletions).values(
            task.completionsHoursAgo.map((hours) => ({
              taskId: taskRow.id,
              completedAt: hoursAgo(hours),
              completedBy: null,
              notes: "",
            })),
          );
        }
      }
    }
    if (dataset.bonds.length > 0) {
      await tx.insert(rabbitBonds).values(
        dataset.bonds.flatMap((bond) => [
          { rabbitId: rabbitIds[bond.a], partnerId: rabbitIds[bond.b] },
          { rabbitId: rabbitIds[bond.b], partnerId: rabbitIds[bond.a] },
        ]),
      );
    }
    if (workerRows.length > 0) {
      await tx.insert(rabbitCarers).values(
        rabbitIds.flatMap((rabbitId) => workerRows.map((worker) => ({ rabbitId, userId: worker.id }))),
      );
    }
    await tx
      .update(settings)
      .set({ demoMode: true, updatedAt: new Date() })
      .where(eq(settings.id, 1));
  });
}

export async function disableDemoData(): Promise<void> {
  const demoRabbits = await db
    .select({ id: rabbits.id })
    .from(rabbits)
    .where(eq(rabbits.isDemo, true));
  if (demoRabbits.length > 0) {
    await db.delete(rabbits).where(eq(rabbits.isDemo, true));
    for (const rabbit of demoRabbits) {
      await deletePhotoDir("rabbit", rabbit.id);
    }
  }
  await db.delete(vets).where(eq(vets.isDemo, true));
  await db.delete(clinics).where(eq(clinics.isDemo, true));
  await db
    .update(settings)
    .set({ demoMode: false, updatedAt: new Date() })
    .where(eq(settings.id, 1));
}
