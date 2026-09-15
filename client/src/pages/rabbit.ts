import { emptyChecklist } from "../../../shared/checklist.ts";
import { bowlReadingKindLabel } from "../../../shared/bowls.ts";
import { checkLogValueParts } from "../../../shared/checkLogs.ts";
import { TASK_SLOTS, TASK_SLOT_LABELS } from "../../../shared/tasks.ts";
import { DAY_SLOT_LABELS } from "../../../shared/slots.ts";
import type {
  AppointmentDto,
  BowlDto,
  CareKind,
  CareRecordDto,
  CareScheduleDto,
  CheckLogDto,
  CheckLogTypeDto,
  ChecklistSectionDto,
  DrugDto,
  HealthCheckDto,
  JournalEntryDto,
  LookupDto,
  MedicationLogDto,
  RabbitDto,
  TaskCompletionDto,
  TaskDto,
  TreatmentDto,
  UserDto,
  VaccinationDto,
} from "../../../shared/types.ts";
import { formatDrugAmount, stockLevel, stockTotalMilliUnits } from "../../../shared/drugs.ts";
import {
  ageLabel,
  careDueStatus,
  dueStatus,
  formatWeight,
  taskDueStatus,
  weightTrend,
} from "../../../shared/health.ts";
import { api } from "../api.ts";
import { loadChecklist } from "../checklist.ts";
import { loadCheckLogTypes } from "../dailyLogs.ts";
import { loadLookups } from "../lookups.ts";
import { openAppointmentModal } from "../components/appointmentModal.ts";
import { openCheckLogModal } from "../components/checkLogModal.ts";
import { openMedicationLogModal } from "../components/medicationLogModal.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { openBowlModal, openBowlReadingModal } from "../components/bowlModal.ts";
import { renderChecksTable } from "../components/checksTable.ts";
import { openCheckModal } from "../components/checkModal.ts";
import { renderChecklistPhotos } from "../components/checklistPhotos.ts";
import { openDrugModal } from "../components/drugModal.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { openLightbox, photoPicker } from "../components/photoPicker.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
import { openTaskModal } from "../components/taskModal.ts";
import { toast } from "../components/toast.ts";
import { optionButtons } from "../components/toggle.ts";
import { openTreatmentModal } from "../components/treatmentModal.ts";
import { slotChips } from "../components/slotChips.ts";
import { openVaccinationModal } from "../components/vaccinationModal.ts";
import { renderWeightChart } from "../components/weightChart.ts";
import { openWeightModal } from "../components/weightModal.ts";
import type { PageContext } from "../context.ts";
import { fmtCalendarDate, fmtDate, fmtTime, h } from "../dom.ts";
import { can } from "../permissions.ts";
import { sexLabel } from "./bunnies.ts";

type RabbitBundle = {
  rabbit: RabbitDto;
  carers: UserDto[];
  bonds: RabbitDto[];
  checks: HealthCheckDto[];
  treatments: TreatmentDto[];
  vaccinations: VaccinationDto[];
  careSchedules: CareScheduleDto[];
  careRecords: CareRecordDto[];
  appointments: AppointmentDto[];
  journal: JournalEntryDto[];
};

export function renderRabbitPage(ctx: PageContext, id: number): HTMLElement {
  const container = h("section", { class: "stack" });
  const canRecord = can(ctx.user, "canRecordHealth");
  const canEdit = can(ctx.user, "canEditRabbits");
  const showCost = can(ctx.user, "canViewCosts");

  async function load(): Promise<void> {
    try {
      const [
        bundle,
        drugResponse,
        checklistSections,
        lookups,
        logTypes,
        checkLogResponse,
        medLogResponse,
        bowlResponse,
        taskResponse,
      ] = await Promise.all([
        api.get<RabbitBundle>(`/api/rabbits/${id}`),
        api.get<{ drugs: DrugDto[] }>("/api/drugs"),
        loadChecklist(),
        loadLookups(),
        loadCheckLogTypes(),
        api.get<{ logs: CheckLogDto[] }>(`/api/check-logs?rabbitId=${id}`),
        api.get<{ logs: MedicationLogDto[] }>(`/api/medication-logs?rabbitId=${id}`),
        api.get<{ bowls: BowlDto[] }>(`/api/bowls?rabbitId=${id}`),
        api.get<{ tasks: TaskDto[]; completions: TaskCompletionDto[] }>(`/api/tasks?rabbitId=${id}`),
      ]);
      const careTypes = lookups.filter((lookup) => lookup.kind === "care_type");
      const sections: (HTMLElement | null)[] = [
        header(bundle.rabbit, bundle.checks, load, canEdit),
        dailyChecksCard(bundle.rabbit, logTypes, checkLogResponse.logs, load, canRecord),
        bowlsCard(bundle.rabbit, bowlResponse.bowls, load, canRecord),
        quickLogCard(bundle.rabbit, checklistSections, load, canRecord),
        tasksCard(bundle.rabbit, taskResponse.tasks, taskResponse.completions, load, canRecord),
        weightCard(bundle.rabbit, bundle.checks, load, canRecord),
        checksCard(bundle.rabbit, bundle.checks, checklistSections, logTypes, load, canRecord),
        vaccinationsCard(bundle.rabbit, bundle.vaccinations, load, canRecord),
        careCard(bundle.rabbit, bundle.careSchedules, bundle.careRecords, careTypes, load, canRecord),
        treatmentsCard(
          bundle.rabbit,
          bundle.treatments,
          drugResponse.drugs,
          medLogResponse.logs,
          load,
          canRecord,
        ),
        medicationCard(
          bundle.rabbit,
          bundle.treatments,
          medLogResponse.logs,
          drugResponse.drugs,
          load,
          canRecord,
        ),
        journalCard(bundle.rabbit, bundle.journal, load, canRecord),
        galleryCard(bundle.checks, bundle.journal, checkLogResponse.logs),
        appointmentsCard(bundle.rabbit, bundle.appointments, load, canRecord, showCost),
        feedingCard(bundle.rabbit, canEdit, load),
        bondsCard(bundle.rabbit, bundle.bonds, load, canEdit),
        ctx.user.isAdmin ? carersCard(bundle.rabbit, bundle.carers) : null,
      ];
      container.replaceChildren(...sections.filter((section): section is HTMLElement => section !== null));
    } catch (err) {
      container.replaceChildren(
        h("div", { class: "empty" }, err instanceof Error ? err.message : "Could not load this bunny."),
      );
    }
  }

  void load();
  return container;
}

function header(
  rabbit: RabbitDto,
  checks: HealthCheckDto[],
  reload: () => Promise<void>,
  canEdit: boolean,
): HTMLElement {
  const photoInput = h("input", { type: "file", accept: "image/*", class: "visually-hidden" });
  const photoError = h("p", { class: "form-error" });
  photoError.style.display = "none";

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    try {
      await api.upload(`/api/rabbits/${rabbit.id}/avatar`, form);
      toast("Photo updated");
      await reload();
    } catch (err) {
      photoError.textContent = err instanceof Error ? err.message : "Upload failed";
      photoError.style.display = "";
    }
  });

  const trend = weightTrend(checks);
  const lastCheck = checks[0];

  return h(
    "div",
    { class: "card" },
    rabbit.status === "deceased"
      ? h(
          "div",
          { class: "banner" },
          `This bunny is marked as deceased${
            rabbit.deceasedAt ? ` (${fmtCalendarDate(rabbit.deceasedAt)})` : ""
          }.${rabbit.deceasedReason ? ` ${rabbit.deceasedReason}` : ""}`,
        )
      : null,
    rabbit.quarantined
      ? h(
          "div",
          { class: "banner" },
          `In quarantine${
            rabbit.quarantineUntil ? ` until ${fmtCalendarDate(rabbit.quarantineUntil)}` : ""
          }.`,
        )
      : null,
    h(
      "div",
      { class: "row", style: { alignItems: "flex-start" } },
      h(
        "div",
        { class: "stack", style: { gap: "0.4rem", alignItems: "center" } },
        rabbitAvatar(rabbit, "lg"),
        canEdit
          ? h(
              "button",
              { class: "btn outline small", type: "button", onClick: () => photoInput.click() },
              rabbit.hasAvatar ? "Change photo" : "Add photo",
            )
          : null,
        photoInput,
      ),
      h(
        "div",
        { class: "stack", style: { gap: "0.4rem" } },
        h("h1", { style: { margin: 0 } }, rabbit.name),
        h(
          "div",
          { class: "row wrap" },
          h("span", { class: "badge" }, sexLabel(rabbit.sex)),
          h("span", { class: "badge" }, ageLabel(rabbit.dateOfBirth)),
          rabbit.desexed ? h("span", { class: "badge" }, "Desexed") : null,
          rabbit.quarantined ? h("span", { class: "badge watch" }, "Quarantine") : null,
          rabbit.status === "deceased" ? h("span", { class: "badge alert" }, "Deceased") : null,
        ),
        h(
          "div",
          { class: "row wrap" },
          canEdit
            ? h(
                "button",
                {
                  class: "btn outline small",
                  type: "button",
                  onClick: () => openRabbitModal({ rabbit, onSaved: () => void reload() }),
                },
                "Edit details",
              )
            : null,
          h("a", { class: "btn outline small", href: `#/rabbit/${rabbit.id}/report` }, "Report"),
        ),
      ),
    ),
    photoError,
    h(
      "div",
      { class: "stat-row" },
      h(
        "div",
        { class: "metric" },
        h("span", { class: "value" }, trend.latest !== null ? formatWeight(trend.latest) : "—"),
        h("span", { class: "label" }, "Latest weight"),
      ),
      h(
        "div",
        { class: "metric" },
        h("span", { class: "value" }, ageLabel(rabbit.dateOfBirth)),
        h("span", { class: "label" }, "Age"),
      ),
      h(
        "div",
        { class: "metric" },
        h("span", { class: "value" }, lastCheck ? fmtDate(lastCheck.checkedAt) : "—"),
        h("span", { class: "label" }, "Last check"),
      ),
    ),
    h(
      "dl",
      { class: "detail-list" },
      h("dt", null, "Breed"),
      h("dd", null, rabbit.breed || "—"),
      h("dt", null, "Colour"),
      h("dd", null, rabbit.colour || "—"),
      h("dt", null, "Microchip"),
      h("dd", null, rabbit.microchip || "—"),
      h("dt", null, "Born"),
      h("dd", null, fmtCalendarDate(rabbit.dateOfBirth)),
    ),
    rabbit.notes ? h("p", { class: "dim", style: { marginBottom: 0 } }, rabbit.notes) : null,
  );
}

function weightCard(
  rabbit: RabbitDto,
  checks: HealthCheckDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const latestWeight = checks.find((check) => check.weightGrams !== null)?.weightGrams ?? null;
  const logWeight = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () =>
        openWeightModal({
          rabbit,
          previousWeightGrams: latestWeight,
          onSaved: () => void reload(),
        }),
    },
    "Log weight",
  );
  const min = rabbit.targetWeightMinGrams;
  const max = rabbit.targetWeightMaxGrams;
  const targetText =
    min != null || max != null
      ? `Target: ${min != null ? formatWeight(min) : "?"} – ${max != null ? formatWeight(max) : "?"}`
      : null;
  const outside =
    latestWeight != null && ((min != null && latestWeight < min) || (max != null && latestWeight > max));
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Weight trend"),
      h("span", { class: "spacer" }),
      canRecord ? logWeight : null,
    ),
    renderWeightChart(checks),
    targetText
      ? h(
          "p",
          { class: "dim small", style: { margin: "0.5rem 0 0" } },
          targetText,
          outside ? h("span", { class: "badge watch", style: { marginLeft: "0.5rem" } }, "Outside target") : null,
        )
      : null,
  );
}

function feedingCard(
  rabbit: RabbitDto,
  canEdit: boolean,
  reload: () => Promise<void>,
): HTMLElement | null {
  if (!rabbit.feedingPlan) return null;
  const edit = h(
    "button",
    {
      class: "btn ghost small",
      type: "button",
      onClick: () => openRabbitModal({ rabbit, onSaved: () => void reload() }),
    },
    "Edit",
  );
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Feeding plan"),
      h("span", { class: "spacer" }),
      canEdit ? edit : null,
    ),
    h("p", { style: { margin: 0, whiteSpace: "pre-wrap" } }, rabbit.feedingPlan),
  );
}

function bondsCard(
  rabbit: RabbitDto,
  initialBonds: RabbitDto[],
  reload: () => Promise<void>,
  canEdit: boolean,
): HTMLElement | null {
  if (!canEdit && initialBonds.length === 0) return null;
  let bonds = initialBonds;
  let options: RabbitDto[] = [];
  const list = h("div", { class: "stack", style: { gap: "0" } });
  const select = h("select");
  const add = h("button", { class: "btn outline small", type: "button" }, "Bond");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  function render(): void {
    if (bonds.length === 0) {
      list.replaceChildren(h("p", { class: "dim small", style: { margin: 0 } }, "No bonded bunnies."));
    } else {
      list.replaceChildren(
        ...bonds.map((bond) =>
          h(
            "div",
            { class: "list-row" },
            h("a", { href: `#/rabbit/${bond.id}` }, bond.name),
            bond.status === "deceased" ? h("span", { class: "badge" }, "Deceased") : null,
            h("span", { class: "spacer" }),
            canEdit
              ? h(
                  "button",
                  {
                    class: "btn ghost small",
                    type: "button",
                    onClick: () =>
                      void save(
                        bonds.filter((item) => item.id !== bond.id).map((item) => item.id),
                      ),
                  },
                  "Remove",
                )
              : null,
          ),
        ),
      );
    }
    const assigned = new Set(bonds.map((bond) => bond.id));
    const available = options.filter((item) => item.id !== rabbit.id && !assigned.has(item.id));
    select.replaceChildren(
      ...(available.length === 0
        ? [h("option", { value: "" }, "No other bunnies")]
        : available.map((item) => h("option", { value: String(item.id) }, item.name))),
    );
    select.style.display = canEdit ? "" : "none";
    add.style.display = canEdit ? "" : "none";
    add.disabled = available.length === 0;
  }

  async function save(ids: number[]): Promise<void> {
    error.style.display = "none";
    try {
      const result = await api.put<{ bonds: RabbitDto[] }>(`/api/rabbits/${rabbit.id}/bonds`, {
        partnerIds: ids,
      });
      bonds = result.bonds;
      render();
      toast("Bonds updated");
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    }
  }

  add.addEventListener("click", () => {
    if (!select.value) return;
    void save([...bonds.map((bond) => bond.id), Number(select.value)]);
  });

  render();
  void api
    .get<{ rabbits: RabbitDto[] }>("/api/rabbits")
    .then(({ rabbits }) => {
      options = rabbits;
      render();
    })
    .catch(() => {
      add.disabled = true;
    });

  return h(
    "div",
    { class: "card" },
    h("h2", null, "Bonded bunnies"),
    h("p", { class: "dim small" }, "Bunnies this one lives with."),
    error,
    list,
    canEdit ? h("div", { class: "row wrap" }, select, add) : null,
  );
}

function galleryCard(
  checks: HealthCheckDto[],
  journal: JournalEntryDto[],
  logs: CheckLogDto[],
): HTMLElement | null {
  const photos: { thumb: string; full: string; alt: string; date: string }[] = [];
  for (const check of checks) {
    if (!check.hasPhoto) continue;
    photos.push({
      thumb: `/api/photos/check/${check.id}?size=thumb`,
      full: `/api/photos/check/${check.id}?size=full`,
      alt: "Check photo",
      date: check.checkedAt,
    });
  }
  for (const entry of journal) {
    for (const photo of entry.photos) {
      photos.push({
        thumb: `/api/photos/journal/${photo.id}?size=thumb`,
        full: `/api/photos/journal/${photo.id}?size=full`,
        alt: photo.caption || "Journal photo",
        date: entry.createdAt,
      });
    }
  }
  for (const log of logs) {
    for (const photo of log.photos) {
      photos.push({
        thumb: `/api/photos/checklog/${photo.id}?size=thumb`,
        full: `/api/photos/checklog/${photo.id}?size=full`,
        alt: photo.caption || `${log.typeLabel} photo`,
        date: log.loggedAt,
      });
    }
  }
  if (photos.length === 0) return null;
  photos.sort((a, b) => b.date.localeCompare(a.date));
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Photos"),
    h(
      "div",
      { class: "journal-photos" },
      photos.map((photo) => {
        const image = h("img", { class: "journal-photo", src: photo.thumb, alt: photo.alt });
        image.addEventListener("click", () => openLightbox(photo.full, photo.alt));
        return image;
      }),
    ),
  );
}

function dailyChecksCard(
  rabbit: RabbitDto,
  types: CheckLogTypeDto[],
  logs: CheckLogDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const openLog = (initialTypeId?: number) =>
    openCheckLogModal({ rabbit, types, initialTypeId, onSaved: () => void reload() });

  const quickButtons =
    canRecord && types.length > 0
      ? h(
          "div",
          { class: "row wrap quick-log-buttons" },
          types.map((type) =>
            h(
              "button",
              { class: "btn outline small", type: "button", onClick: () => openLog(type.id) },
              type.label,
            ),
          ),
        )
      : null;

  const list = h("div", { class: "stack", style: { gap: "0" } });
  const recent = logs.slice(0, 10);
  if (recent.length === 0) {
    list.append(h("p", { class: "dim small", style: { margin: 0 } }, "No daily checks logged yet."));
  }
  for (const entry of recent) {
    const value = checkLogValueParts(entry).join(" · ");
    const photos =
      entry.photos.length > 0
        ? h(
            "div",
            { class: "check-photos" },
            entry.photos.map((photo) => {
              const alt = photo.caption || `${entry.typeLabel} photo`;
              const image = h("img", {
                class: "check-photo",
                src: `/api/photos/checklog/${photo.id}?size=thumb`,
                alt,
              });
              image.addEventListener("click", () =>
                openLightbox(`/api/photos/checklog/${photo.id}?size=full`, alt),
              );
              return image;
            }),
          )
        : null;
    list.append(
      h(
        "div",
        { class: "list-row" },
        h(
          "div",
          { class: "stack", style: { gap: "0.15rem" } },
          h("strong", null, entry.typeLabel),
          value ? h("span", { class: "dim small" }, value) : null,
          entry.notes ? h("span", { class: "dim small" }, entry.notes) : null,
          photos,
        ),
        h("span", { class: "spacer" }),
        h("span", { class: "dim small" }, `${fmtDate(entry.loggedAt)} ${fmtTime(entry.loggedAt)}`),
        canRecord
          ? h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                onClick: () => openCheckLogModal({ rabbit, types, log: entry, onSaved: () => void reload() }),
              },
              "Edit",
            )
          : null,
        canRecord
          ? h(
              "button",
              { class: "btn ghost small", type: "button", onClick: () => void removeCheckLog(entry, reload) },
              "Delete",
            )
          : null,
      ),
    );
  }
  const log = h(
    "button",
    {
      class: "btn primary small",
      type: "button",
      onClick: () => openLog(),
    },
    "Log",
  );
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Daily checks"),
      h("span", { class: "spacer" }),
      canRecord && types.length > 0 ? log : null,
    ),
    h(
      "p",
      { class: "dim small" },
      "Poo, water, food, behaviour and anything else worth tracking each day. Tap a type to log it, add photos, or pick several options at once.",
    ),
    quickButtons,
    list,
  );
}

async function removeCheckLog(entry: CheckLogDto, reload: () => Promise<void>): Promise<void> {
  const confirmed = await confirmDialog({
    title: `Delete ${entry.typeLabel} log?`,
    message: "This removes the entry.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/check-logs/${entry.id}`);
  toast("Log deleted");
  await reload();
}

function bowlsCard(
  rabbit: RabbitDto,
  bowls: BowlDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const add = canRecord
    ? h(
        "button",
        { class: "btn outline small", type: "button", onClick: () => openBowlModal({ rabbit, onSaved: () => void reload() }) },
        "Add bowl",
      )
    : null;
  const list = h("div", { class: "stack", style: { gap: "0.75rem" } });
  if (bowls.length === 0) {
    list.append(h("p", { class: "dim small", style: { margin: 0 } }, "No bowls tracked yet."));
  }
  for (const bowl of bowls) list.append(bowlPanel(rabbit, bowl, reload, canRecord));
  return h(
    "div",
    { class: "card" },
    h("div", { class: "card-title" }, h("h2", null, "Food & water"), h("span", { class: "spacer" }), add),
    h(
      "p",
      { class: "dim small" },
      "Track consumption by weighing the bowl. Each weigh-in rolls the baseline forward, top-ups can add to the current weight or set a new total, and refresh starts a new period.",
    ),
    list,
  );
}

function bowlPanel(
  rabbit: RabbitDto,
  bowl: BowlDto,
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const parts = [
    bowl.periodStartAt ? `Since ${fmtDate(bowl.periodStartAt)}` : null,
    bowl.currentWeightGrams != null ? `${bowl.currentWeightGrams} g now` : null,
    `${bowl.periodConsumptionGrams} g consumed`,
    bowl.periodRefillGrams > 0 ? `${bowl.periodRefillGrams} g topped up` : null,
  ].filter(Boolean);
  const todayReadings = bowl.readings.filter(
    (reading) => localDayKey(new Date(reading.readAt)) === localDayKey(new Date()),
  );
  const schedule = slotChips({
    slots: bowl.slots,
    logs: todayReadings,
    canRecord,
    onLog: (slot) =>
      openBowlReadingModal({ bowl, mode: "weigh", date: new Date(), slot, onSaved: () => void reload() }),
  });
  const actions = canRecord
    ? h(
        "div",
        { class: "row wrap" },
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => openBowlReadingModal({ bowl, mode: "weigh", onSaved: () => void reload() }) },
          "Weigh",
        ),
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => openBowlReadingModal({ bowl, mode: "refill", onSaved: () => void reload() }) },
          "Top up",
        ),
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => openBowlReadingModal({ bowl, mode: "refresh", onSaved: () => void reload() }) },
          "Refresh",
        ),
        h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => openBowlModal({ rabbit, bowl, onSaved: () => void reload() }) },
          "Edit",
        ),
        h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void removeBowl(bowl, reload) },
          "Delete",
        ),
      )
    : null;
  const readingsWrap = h("div", { class: "stack", style: { gap: "0" } });
  const more = h("button", { class: "btn ghost small", type: "button" }, "");
  let expanded = false;
  const renderReadings = () => {
    const shown = expanded ? bowl.readings : bowl.readings.slice(0, 5);
    readingsWrap.replaceChildren(
      ...shown.map((reading) => bowlReadingRow(bowl, reading, reload, canRecord)),
    );
    more.textContent = expanded ? "Show recent" : `Show all (${bowl.readings.length})`;
    more.style.display = bowl.readings.length > 5 ? "" : "none";
  };
  more.addEventListener("click", () => {
    expanded = !expanded;
    renderReadings();
  });
  renderReadings();
  return h(
    "div",
    { class: "bowl-panel" },
    h(
      "div",
      { class: "row wrap" },
      h("strong", null, bowl.label),
      h("span", { class: "dim small" }, parts.join(" · ")),
    ),
    schedule,
    actions,
    bowl.readings.length > 0
      ? h("div", { class: "stack", style: { gap: "0.4rem" } }, readingsWrap, more)
      : null,
  );
}

function bowlReadingRow(
  bowl: BowlDto,
  reading: BowlDto["readings"][number],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const delta =
    reading.consumptionGrams > 0
      ? `-${reading.consumptionGrams} g`
      : reading.refillGrams > 0
        ? `+${reading.refillGrams} g`
        : null;
  return h(
    "div",
    { class: "list-row" },
    h(
      "div",
      { class: "stack", style: { gap: "0.15rem" } },
      h(
        "span",
        null,
        bowlReadingKindLabel(reading.kind),
        reading.slot ? h("span", { class: "dim small" }, ` · ${DAY_SLOT_LABELS[reading.slot]}`) : null,
        delta ? h("span", { class: "dim small" }, ` ${delta}`) : null,
      ),
      reading.notes ? h("span", { class: "dim small" }, reading.notes) : null,
    ),
    h("span", { class: "spacer" }),
    h("span", { class: "dim small" }, `${fmtDate(reading.readAt)} ${fmtTime(reading.readAt)} · ${reading.weightGrams} g`),
    canRecord
      ? h(
          "button",
          {
            class: "btn ghost small",
            type: "button",
            onClick: () => void removeBowlReading(bowl, reading.id, reload),
          },
          "Delete",
        )
      : null,
  );
}

async function removeBowl(bowl: BowlDto, reload: () => Promise<void>): Promise<void> {
  const confirmed = await confirmDialog({
    title: `Delete ${bowl.label}?`,
    message: "This removes the bowl and its readings.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/bowls/${bowl.id}`);
  toast("Bowl deleted");
  await reload();
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function removeBowlReading(
  bowl: BowlDto,
  readingId: number,
  reload: () => Promise<void>,
): Promise<void> {
  const confirmed = await confirmDialog({
    title: "Delete reading?",
    message: "Consumption totals are recalculated from the remaining readings.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/bowls/${bowl.id}/readings/${readingId}`);
  toast("Reading deleted");
  await reload();
}

function tasksCard(
  rabbit: RabbitDto,
  tasks: TaskDto[],
  completions: TaskCompletionDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const now = new Date();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const due = tasks
    .filter(
      (task) => task.active && taskDueStatus(task.lastCompletedAt, task.intervalDays, now) === "due",
    )
    .sort((a, b) => TASK_SLOTS.indexOf(a.slot) - TASK_SLOTS.indexOf(b.slot) || a.id - b.id);

  const list = h("div", { class: "stack", style: { gap: "0" } });
  if (due.length === 0) {
    list.append(h("p", { class: "dim small", style: { margin: 0 } }, "Nothing due right now."));
  }
  let currentSlot: TaskDto["slot"] | null = null;
  for (const task of due) {
    if (task.slot !== currentSlot) {
      currentSlot = task.slot;
      list.append(h("p", { class: "task-slot dim small" }, TASK_SLOT_LABELS[task.slot]));
    }
    const detail = [
      task.intervalDays === 1 ? "every day" : `every ${task.intervalDays} days`,
      task.lastCompletedAt ? `last done ${fmtDate(task.lastCompletedAt)}` : "not done yet",
    ]
      .filter(Boolean)
      .join(" · ");
    list.append(
      h(
        "div",
        { class: "list-row" },
        h(
          "div",
          { class: "stack", style: { gap: "0.15rem" } },
          h("strong", null, task.label),
          h("span", { class: "dim small" }, detail),
          task.notes ? h("span", { class: "dim small" }, task.notes) : null,
        ),
        h("span", { class: "spacer" }),
        canRecord
          ? h(
              "button",
              { class: "btn primary small", type: "button", onClick: () => void completeTask(task) },
              "Done",
            )
          : null,
        canRecord
          ? h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                onClick: () => openTaskModal({ rabbit, task, onSaved: () => void reload() }),
              },
              "Edit",
            )
          : null,
      ),
    );
  }

  const recent = completions.slice(0, 5);
  if (recent.length > 0) {
    list.append(h("p", { class: "task-slot dim small" }, "Recently completed"));
    for (const completion of recent) {
      const task = taskById.get(completion.taskId);
      list.append(
        h(
          "div",
          { class: "list-row" },
          h("span", { class: "badge ok" }, "Done"),
          h(
            "div",
            { class: "stack", style: { gap: "0.15rem" } },
            h("strong", null, task?.label ?? "Task"),
            h(
              "span",
              { class: "dim small" },
              `${fmtDate(completion.completedAt)} ${fmtTime(completion.completedAt)}`,
            ),
          ),
          h("span", { class: "spacer" }),
          canRecord
            ? h(
                "button",
                {
                  class: "btn ghost small",
                  type: "button",
                  onClick: () => void undoCompletion(completion),
                },
                "Undo",
              )
            : null,
        ),
      );
    }
  }

  const add = canRecord
    ? h(
        "button",
        {
          class: "btn outline small",
          type: "button",
          onClick: () => openTaskModal({ rabbit, onSaved: () => void reload() }),
        },
        "Add task",
      )
    : null;

  return h(
    "div",
    { class: "card" },
    h("div", { class: "card-title" }, h("h2", null, "Daily routine"), h("span", { class: "spacer" }), add),
    h(
      "p",
      { class: "dim small" },
      "Repeating chores and care rounds. Tap Done when finished.",
    ),
    list,
  );

  async function completeTask(task: TaskDto): Promise<void> {
    try {
      await api.post(`/api/tasks/${task.id}/complete`, {
        completedAt: new Date().toISOString(),
        notes: "",
      });
      toast("Done");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete the task", "error");
    }
  }

  async function undoCompletion(completion: TaskCompletionDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Undo completion?",
      message: "The task becomes due again.",
      confirmLabel: "Undo",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/tasks/completions/${completion.id}`);
    toast("Completion removed");
    await reload();
  }
}

function medicationCard(
  rabbit: RabbitDto,
  treatments: TreatmentDto[],
  logs: MedicationLogDto[],
  drugs: DrugDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const list = h("div", { class: "stack", style: { gap: "0" } });
  const oneOff = logs.filter((entry) => entry.treatmentId === null);
  if (oneOff.length === 0) {
    list.append(h("p", { class: "dim small", style: { margin: 0 } }, "No one-off doses logged yet."));
  }
  for (const entry of oneOff.slice(0, 10)) {
    list.append(medicationLogRow(rabbit, entry, treatments, drugs, logs, reload, canRecord));
  }
  const log = h(
    "button",
    {
      class: "btn primary small",
      type: "button",
      onClick: () => openMedicationLogModal({ rabbit, treatments, drugs, logs, onSaved: () => void reload() }),
    },
    "Log a dose",
  );
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Medication log"),
      h("span", { class: "spacer" }),
      canRecord ? log : null,
    ),
    h(
      "p",
      { class: "dim small" },
      "One-off doses that are not part of a treatment. Doses linked to a treatment are grouped under that treatment above; every logged dose deducts from drug stock.",
    ),
    list,
  );
}

function medicationLogRow(
  rabbit: RabbitDto,
  entry: MedicationLogDto,
  treatments: TreatmentDto[],
  drugs: DrugDto[],
  logs: MedicationLogDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const drug = drugs.find((item) => item.id === entry.drugId);
  const amount =
    entry.amountMilliUnits != null
      ? formatDrugAmount(entry.amountMilliUnits, drug?.unit ?? "dose")
      : "";
  const detail = [entry.slot ? DAY_SLOT_LABELS[entry.slot] : null, amount]
    .filter(Boolean)
    .join(" · ");
  return h(
    "div",
    { class: "list-row" },
    h(
      "div",
      { class: "stack", style: { gap: "0.15rem" } },
      h("strong", null, drug?.name ?? "Medication"),
      detail ? h("span", { class: "dim small" }, detail) : null,
      entry.notes ? h("span", { class: "dim small" }, entry.notes) : null,
    ),
    h("span", { class: "spacer" }),
    h("span", { class: "dim small" }, `${fmtDate(entry.givenAt)} ${fmtTime(entry.givenAt)}`),
    canRecord
      ? h(
          "button",
          {
            class: "btn ghost small",
            type: "button",
            onClick: () =>
              openMedicationLogModal({
                rabbit,
                treatments,
                drugs,
                logs,
                editing: entry,
                onSaved: () => void reload(),
              }),
          },
          "Edit",
        )
      : null,
    canRecord
      ? h(
          "button",
          { class: "btn ghost small", type: "button", onClick: () => void removeMedicationLog(entry, reload) },
          "Delete",
        )
      : null,
  );
}

async function removeMedicationLog(entry: MedicationLogDto, reload: () => Promise<void>): Promise<void> {
  const confirmed = await confirmDialog({
    title: "Delete dose log?",
    message: "The logged amount is returned to drug stock.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/medication-logs/${entry.id}`);
  toast("Dose log deleted");
  await reload();
}

function quickLogCard(
  rabbit: RabbitDto,
  sections: ChecklistSectionDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement | null {
  if (!canRecord || sections.length === 0) return null;

  const fields = sections.map((section) => {
    const otherInput = h("input", { type: "text", placeholder: "Other details…" });
    const otherField = h(
      "div",
      { class: "field checklist-other" },
      h("label", null, "Other details"),
      otherInput,
    );
    otherField.style.display = "none";
    const group = optionButtons(section.options, [], section.multiple, (values) => {
      otherField.style.display = values.includes("other") ? "" : "none";
    });
    return {
      section,
      group,
      otherInput,
      reset: () => {
        group.setValues([]);
        otherInput.value = "";
        otherField.style.display = "none";
      },
      root: h(
        "details",
        { class: "quick-section" },
        h("summary", null, section.label),
        renderChecklistPhotos(section),
        group.root,
        otherField,
      ),
    };
  });

  const note = h("textarea", { placeholder: "What did you notice?" });
  const picker = photoPicker({ label: "Add photo" });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary small", type: "button" }, "Log observation");

  save.addEventListener("click", async () => {
    error.style.display = "none";
    const checklist = emptyChecklist();
    for (const field of fields) {
      const values = field.group.read();
      const other = field.otherInput.value.trim();
      if (values.length > 0 || other) checklist[field.section.key] = { values, other };
    }
    const text = note.value.trim();
    if (Object.keys(checklist).length === 0 && !text) {
      error.textContent = "Tick at least one item or add a note.";
      error.style.display = "";
      return;
    }
    save.disabled = true;
    try {
      const result = await api.post<{ check: HealthCheckDto }>("/api/checks", {
        rabbitId: rabbit.id,
        checkedAt: new Date().toISOString(),
        checklist,
        notes: text,
      });
      const file = picker.file();
      if (file) {
        const form = new FormData();
        form.append("photo", file);
        await api.upload(`/api/checks/${result.check.id}/photo`, form);
      }
      note.value = "";
      for (const field of fields) field.reset();
      toast("Observation logged");
      await reload();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    } finally {
      save.disabled = false;
    }
  });

  return h(
    "div",
    { class: "card" },
    h("h2", null, "Quick log"),
    h(
      "p",
      { class: "dim small" },
      "Tick anything you noticed and log it as a health check — no full form needed.",
    ),
    error,
    h("div", { class: "quick-grid" }, fields.map((field) => field.root)),
    h("div", { class: "field" }, h("label", null, "Note"), note),
    h("div", { class: "field" }, h("label", null, "Photo"), picker.root),
    h("div", { class: "row" }, save),
  );
}

function journalCard(
  rabbit: RabbitDto,
  entries: JournalEntryDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Notes & photos"),
    h(
      "p",
      { class: "dim small" },
      "A timestamped diary for this bunny — vet visits, progress, anything worth remembering.",
    ),
    canRecord ? journalCompose(rabbit, reload) : null,
    entries.length === 0
      ? h("div", { class: "empty" }, "No journal entries yet.")
      : h("div", { class: "journal-list" }, entries.map((entry) => journalEntry(entry, reload, canRecord))),
  );
}

function journalCompose(rabbit: RabbitDto, reload: () => Promise<void>): HTMLElement {
  const note = h("textarea", { placeholder: "Add a note…" });
  const input = h("input", {
    type: "file",
    accept: "image/*",
    multiple: true,
    class: "visually-hidden",
  });
  const fileLabel = h("span", { class: "dim small" }, "No photos selected");
  const choose = h(
    "button",
    { class: "btn outline small", type: "button", onClick: () => input.click() },
    "Add photos",
  );
  input.addEventListener("change", () => {
    const count = input.files?.length ?? 0;
    fileLabel.textContent =
      count === 0 ? "No photos selected" : `${count} photo${count === 1 ? "" : "s"} selected`;
  });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const post = h("button", { class: "btn primary small", type: "button" }, "Post entry");

  post.addEventListener("click", async () => {
    error.style.display = "none";
    const text = note.value.trim();
    const files = input.files ? Array.from(input.files) : [];
    if (!text && files.length === 0) {
      error.textContent = "Add a note or at least one photo.";
      error.style.display = "";
      return;
    }
    post.disabled = true;
    try {
      const created = await api.post<{ entry: JournalEntryDto }>("/api/journal", {
        rabbitId: rabbit.id,
        note: text,
      });
      for (const file of files) {
        const form = new FormData();
        form.append("photo", file);
        await api.upload(`/api/journal/${created.entry.id}/photos`, form);
      }
      note.value = "";
      input.value = "";
      fileLabel.textContent = "No photos selected";
      toast("Journal entry added");
      await reload();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    } finally {
      post.disabled = false;
    }
  });

  return h(
    "div",
    { class: "journal-compose" },
    error,
    h("div", { class: "field" }, h("label", null, "Note"), note),
    h(
      "div",
      { class: "field" },
      h("label", null, "Photos"),
      h("div", { class: "row wrap" }, choose, fileLabel),
      input,
    ),
    h("div", { class: "row" }, post),
  );
}

function journalEntry(
  entry: JournalEntryDto,
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const photos =
    entry.photos.length > 0
      ? h(
          "div",
          { class: "journal-photos" },
          entry.photos.map((photo) => {
            const alt = photo.caption || "Journal photo";
            const image = h("img", {
              class: "journal-photo",
              src: `/api/photos/journal/${photo.id}?size=thumb`,
              alt,
            });
            image.addEventListener("click", () =>
              openLightbox(`/api/photos/journal/${photo.id}?size=full`, alt),
            );
            return image;
          }),
        )
      : null;
  return h(
    "div",
    { class: "journal-entry" },
    h(
      "div",
      { class: "journal-head" },
      h("strong", null, fmtDate(entry.createdAt)),
      h("span", { class: "dim small" }, fmtTime(entry.createdAt)),
      h("span", { class: "spacer" }),
      canRecord
        ? h(
            "button",
            {
              class: "btn ghost small",
              type: "button",
              onClick: () => openJournalEdit(entry, reload),
            },
            "Edit",
          )
        : null,
      canRecord
        ? h(
            "button",
            {
              class: "btn ghost small",
              type: "button",
              onClick: () => void removeJournal(entry, reload),
            },
            "Delete",
          )
        : null,
    ),
    entry.note ? h("p", { class: "journal-note" }, entry.note) : null,
    photos,
  );
}

function openJournalEdit(entry: JournalEntryDto, reload: () => Promise<void>): void {
  const note = h("textarea", null, entry.note);
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Save");
  const modal = openModal({
    guardUnsaved: true,
    title: "Edit journal entry",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          try {
            await api.patch(`/api/journal/${entry.id}`, { note: note.value.trim() });
            toast("Journal entry updated");
            modal.close();
            await reload();
          } catch (err) {
            error.textContent = err instanceof Error ? err.message : "Something went wrong";
            error.style.display = "";
          } finally {
            save.disabled = false;
          }
        },
      },
      error,
      h("div", { class: "field" }, h("label", null, "Note"), note),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

async function removeJournal(entry: JournalEntryDto, reload: () => Promise<void>): Promise<void> {
  const confirmed = await confirmDialog({
    title: "Delete journal entry?",
    message: "This removes the note and its photos. This cannot be undone.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/journal/${entry.id}`);
  toast("Journal entry deleted");
  await reload();
}

function checksCard(
  rabbit: RabbitDto,
  checks: HealthCheckDto[],
  sections: ChecklistSectionDto[],
  logTypes: CheckLogTypeDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const latestWeight = checks.find((check) => check.weightGrams !== null)?.weightGrams ?? null;
  const log = h(
    "button",
    {
      class: "btn primary small",
      type: "button",
      onClick: () =>
        openCheckModal({
          rabbits: [rabbit],
          rabbitId: rabbit.id,
          previousWeightGrams: latestWeight,
          onSaved: () => void reload(),
        }),
    },
    "Log a check",
  );
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Health checks"),
      h("span", { class: "spacer" }),
      canRecord ? log : null,
    ),
    checks.length === 0
      ? h("div", { class: "empty" }, "No health checks yet.")
      : renderChecksTable({
          checks,
          rabbits: [rabbit],
          sections,
          logTypes,
          onChanged: reload,
          canEdit: canRecord,
        }),
  );
}

function treatmentsCard(
  rabbit: RabbitDto,
  treatments: TreatmentDto[],
  drugs: DrugDto[],
  logs: MedicationLogDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const add = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () =>
        openTreatmentModal({ rabbits: [rabbit], rabbitId: rabbit.id, onSaved: () => void reload() }),
    },
    "Add treatment",
  );
  const order: Record<string, number> = { active: 0, completed: 1, stopped: 1 };
  const sorted = [...treatments].sort(
    (a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2) || b.startDate.localeCompare(a.startDate),
  );
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Treatments"),
      h("span", { class: "spacer" }),
      canRecord ? add : null,
    ),
    sorted.length === 0
      ? h("div", { class: "empty" }, "No treatments recorded.")
      : h(
          "div",
          null,
          sorted.map((treatment) =>
            treatmentRow(rabbit, treatment, treatments, drugs, logs, reload, canRecord),
          ),
        ),
  );
}

function treatmentRow(
  rabbit: RabbitDto,
  treatment: TreatmentDto,
  treatments: TreatmentDto[],
  drugs: DrugDto[],
  logs: MedicationLogDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const drug = drugs.find((item) => item.id === treatment.drugId) ?? null;
  const level = drug
    ? stockLevel(stockTotalMilliUnits(drug.batches), drug.reorderLevelMilliUnits)
    : null;
  const history = logs.filter((entry) => entry.treatmentId === treatment.id);
  const slotLabels = treatment.slots.map((slot) => DAY_SLOT_LABELS[slot]).join(", ");
  const todayLogs = logs.filter(
    (entry) =>
      entry.treatmentId === treatment.id &&
      localDayKey(new Date(entry.givenAt)) === localDayKey(new Date()),
  );
  const schedule =
    treatment.status === "active"
      ? slotChips({
          slots: treatment.slots,
          logs: todayLogs,
          canRecord,
          onLog: (slot) =>
            openMedicationLogModal({
              rabbit,
              treatments,
              drugs,
              logs,
              treatmentId: treatment.id,
              slot,
              date: new Date(),
              onSaved: () => void reload(),
            }),
        })
      : null;
  return h(
    "div",
    { class: "list-row" },
    h(
      "div",
      { class: "stack", style: { gap: "0.15rem" } },
      h("strong", null, treatment.medication),
      h(
        "span",
        { class: "dim small" },
        [treatment.dose, treatment.frequency, slotLabels, treatment.reason]
          .filter(Boolean)
          .join(" · ") || "—",
      ),
      h(
        "span",
        { class: "dim small" },
        `${fmtCalendarDate(treatment.startDate)} → ${treatment.endDate ? fmtCalendarDate(treatment.endDate) : "ongoing"}`,
      ),
      schedule,
      drug
        ? h(
            "div",
            { class: "row wrap" },
            h(
              "span",
              { class: `badge ${level === "ok" ? "ok" : level === "low" ? "watch" : "danger"}` },
              level === "ok" ? "In stock" : level === "low" ? "Low stock" : "Out of stock",
            ),
            canRecord
              ? h(
                  "button",
                  {
                    class: "btn ghost small",
                    type: "button",
                    onClick: () =>
                      openDrugModal({
                        drug,
                        onSaved: () => void reload(),
                        onDeleted: () => void reload(),
                      }),
                  },
                  "Drug details",
                )
              : null,
          )
        : null,
      drug?.howToUse
        ? h(
            "details",
            null,
            h("summary", { class: "dim small" }, "How to use"),
            h("p", { class: "dim small", style: { margin: "0.25rem 0 0" } }, drug.howToUse),
          )
        : null,
      history.length > 0
        ? h(
            "details",
            null,
            h("summary", { class: "dim small" }, `Dose history (${history.length})`),
            h(
              "div",
              { class: "stack", style: { gap: "0" } },
              history.map((entry) =>
                medicationLogRow(rabbit, entry, treatments, drugs, logs, reload, canRecord),
              ),
            ),
          )
        : null,
    ),
    h("span", { class: "spacer" }),
    h(
      "span",
      { class: `badge ${treatment.status === "active" ? "accent" : ""}` },
      treatment.status,
    ),
    canRecord && treatment.status === "active" && treatment.slots.length === 0
      ? h(
          "button",
          {
            class: "btn outline small",
            type: "button",
            onClick: () =>
              openMedicationLogModal({
                rabbit,
                treatments,
                drugs,
                logs,
                treatmentId: treatment.id,
                date: new Date(),
                onSaved: () => void reload(),
              }),
          },
          "Log dose",
        )
      : null,
    canRecord
      ? h(
          "button",
          {
            class: "btn ghost small",
            type: "button",
            onClick: () =>
              openTreatmentModal({
                rabbits: [rabbit],
                treatment,
                onSaved: () => void reload(),
              }),
          },
          "Edit",
        )
      : null,
    canRecord
      ? h(
          "button",
          {
            class: "btn ghost small",
            type: "button",
            onClick: () => void removeTreatment(treatment, reload),
          },
          "Delete",
        )
      : null,
  );
}

async function removeTreatment(treatment: TreatmentDto, reload: () => Promise<void>): Promise<void> {
  const confirmed = await confirmDialog({
    title: `Delete ${treatment.medication}?`,
    message: "This removes the treatment record.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/treatments/${treatment.id}`);
  toast("Treatment deleted");
  await reload();
}

function vaccinationsCard(
  rabbit: RabbitDto,
  vaccinations: VaccinationDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const add = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () =>
        openVaccinationModal({ rabbits: [rabbit], rabbitId: rabbit.id, onSaved: () => void reload() }),
    },
    "Add vaccination",
  );
  const now = new Date();
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Vaccinations"),
      h("span", { class: "spacer" }),
      canRecord ? add : null,
    ),
    vaccinations.length === 0
      ? h("div", { class: "empty" }, "No vaccinations recorded.")
      : h(
          "div",
          null,
          vaccinations.map((vaccination) => {
            const status = dueStatus(vaccination.nextDueAt, now, 30);
            return h(
              "div",
              { class: "list-row" },
              h(
                "div",
                { class: "stack", style: { gap: "0.15rem" } },
                h("strong", null, vaccination.vaccine),
                h(
                  "span",
                  { class: "dim small" },
                  `Given ${fmtCalendarDate(vaccination.givenAt)}${
                    vaccination.nextDueAt ? ` · Next due ${fmtCalendarDate(vaccination.nextDueAt)}` : ""
                  }`,
                ),
                vaccination.vet ? h("span", { class: "dim small" }, vaccination.vet) : null,
              ),
              h("span", { class: "spacer" }),
              dueBadge(status),
              canRecord
                ? h(
                    "button",
                    {
                      class: "btn ghost small",
                      type: "button",
                      onClick: () =>
                        openVaccinationModal({
                          rabbits: [rabbit],
                          vaccination,
                          onSaved: () => void reload(),
                        }),
                    },
                    "Edit",
                  )
                : null,
              canRecord
                ? h(
                    "button",
                    {
                      class: "btn ghost small",
                      type: "button",
                      onClick: () => void removeVaccination(vaccination, reload),
                    },
                    "Delete",
                  )
                : null,
            );
          }),
        ),
  );
}

async function removeVaccination(
  vaccination: VaccinationDto,
  reload: () => Promise<void>,
): Promise<void> {
  const confirmed = await confirmDialog({
    title: `Delete ${vaccination.vaccine}?`,
    message: "This removes the vaccination record.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/vaccinations/${vaccination.id}`);
  toast("Vaccination deleted");
  await reload();
}

function careCard(
  rabbit: RabbitDto,
  schedules: CareScheduleDto[],
  records: CareRecordDto[],
  careTypes: LookupDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
): HTMLElement {
  const now = new Date();
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Routine care"),
    h(
      "div",
      null,
      careTypes.map((careType) => {
        const kind = careType.value;
        const schedule = schedules.find((item) => item.kind === kind);
        const last = records
          .filter((record) => record.kind === kind)
          .sort((a, b) => b.doneAt.localeCompare(a.doneAt))[0];
        const intervalDays = schedule?.intervalDays ?? 0;
        const status = careDueStatus(last?.doneAt ?? null, intervalDays, now, 7);
        const dueAt = nextDueDate(last?.doneAt ?? null, intervalDays);
        return h(
          "div",
          { class: "list-row" },
          h(
            "div",
            { class: "stack", style: { gap: "0.15rem" } },
            h("strong", null, careType.label),
            h(
              "span",
              { class: "dim small" },
              `${last ? `Last done ${fmtCalendarDate(last.doneAt)}` : "Never recorded"} · ${
                schedule ? `Every ${schedule.intervalDays} days` : "No schedule"
              }${dueAt ? ` · Next due ${fmtCalendarDate(dueAt)}` : ""}`,
            ),
          ),
          h("span", { class: "spacer" }),
          dueBadge(status),
          canRecord
            ? h(
                "button",
                {
                  class: "btn outline small",
                  type: "button",
                  onClick: () => void markDone(rabbit, kind, careType.label, reload),
                },
                "Mark done today",
              )
            : null,
          canRecord
            ? h(
                "button",
                {
                  class: "btn ghost small",
                  type: "button",
                  onClick: () =>
                    openIntervalModal(
                      rabbit,
                      kind,
                      careType.label,
                      schedule,
                      careType.defaultInt ?? 30,
                      reload,
                    ),
                },
                schedule ? "Edit interval" : "Set interval",
              )
            : null,
        );
      }),
    ),
  );
}

async function markDone(
  rabbit: RabbitDto,
  kind: CareKind,
  label: string,
  reload: () => Promise<void>,
): Promise<void> {
  await api.post("/api/care-records", { rabbitId: rabbit.id, kind, doneAt: todayInputValue() });
  toast(`${label} marked done today`);
  await reload();
}

function openIntervalModal(
  rabbit: RabbitDto,
  kind: CareKind,
  label: string,
  schedule: CareScheduleDto | undefined,
  defaultDays: number,
  reload: () => Promise<void>,
): void {
  const interval = h("input", {
    type: "number",
    min: "1",
    max: "3650",
    value: schedule ? String(schedule.intervalDays) : String(defaultDays),
  });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, "Save interval");

  const modal = openModal({
    guardUnsaved: true,
    title: `${label} schedule`,
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          try {
            await api.put(`/api/rabbits/${rabbit.id}/care-schedules`, {
              kind,
              intervalDays: Number(interval.value),
            });
            await reload();
            modal.close();
          } catch (err) {
            error.textContent = err instanceof Error ? err.message : "Something went wrong";
            error.style.display = "";
          } finally {
            save.disabled = false;
          }
        },
      },
      error,
      h("div", { class: "field" }, h("label", null, "Interval in days"), interval),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}

function appointmentsCard(
  rabbit: RabbitDto,
  appointments: AppointmentDto[],
  reload: () => Promise<void>,
  canRecord: boolean,
  showCost: boolean,
): HTMLElement {
  const add = h(
    "button",
    {
      class: "btn outline small",
      type: "button",
      onClick: () =>
        openAppointmentModal({
          rabbits: [rabbit],
          rabbitId: rabbit.id,
          showCost,
          onSaved: () => void reload(),
        }),
    },
    "Add appointment",
  );
  const upcoming = appointments
    .filter((appointment) => appointment.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = appointments
    .filter((appointment) => appointment.status !== "scheduled")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Appointments"),
      h("span", { class: "spacer" }),
      canRecord ? add : null,
    ),
    appointments.length === 0
      ? h("div", { class: "empty" }, "No appointments.")
      : h(
          "div",
          null,
          [...upcoming, ...past].map((appointment) =>
            h(
              "div",
              { class: "list-row" },
              h(
                "div",
                { class: "stack", style: { gap: "0.15rem" } },
                h("strong", null, appointment.title),
                h(
                  "span",
                  { class: "dim small" },
                  `${fmtDate(appointment.scheduledAt)} ${fmtTime(appointment.scheduledAt)}${
                    appointment.clinic ? ` · ${appointment.clinic}` : ""
                  }`,
                ),
                showCost && appointment.costCents != null
                  ? h("span", { class: "dim small" }, `$${(appointment.costCents / 100).toFixed(2)}`)
                  : null,
              ),
              h("span", { class: "spacer" }),
              h(
                "span",
                { class: `badge ${appointment.status === "scheduled" ? "accent" : ""}` },
                appointment.status,
              ),
              canRecord
                ? h(
                    "button",
                    {
                      class: "btn ghost small",
                      type: "button",
                      onClick: () =>
                        openAppointmentModal({
                          rabbits: [rabbit],
                          appointment,
                          showCost,
                          onSaved: () => void reload(),
                        }),
                    },
                    "Edit",
                  )
                : null,
              canRecord
                ? h(
                    "button",
                    {
                      class: "btn ghost small",
                      type: "button",
                      onClick: () => void removeAppointment(appointment, reload),
                    },
                    "Delete",
                  )
                : null,
            ),
          ),
        ),
  );
}

async function removeAppointment(
  appointment: AppointmentDto,
  reload: () => Promise<void>,
): Promise<void> {
  const confirmed = await confirmDialog({
    title: `Delete ${appointment.title}?`,
    message: "This removes the appointment.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  await api.del(`/api/appointments/${appointment.id}`);
  toast("Appointment deleted");
  await reload();
}

function carersCard(rabbit: RabbitDto, initialCarers: UserDto[]): HTMLElement {
  let carers = initialCarers;
  let workers: UserDto[] = [];
  const list = h("div");
  const select = h("select");
  const add = h("button", { class: "btn outline small", type: "button" }, "Assign");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  function render(): void {
    if (carers.length === 0) {
      list.replaceChildren(h("p", { class: "dim small" }, "No carers assigned yet."));
    } else {
      list.replaceChildren(
        ...carers.map((carer) =>
          h(
            "div",
            { class: "list-row" },
            h("strong", null, carer.displayName || carer.username),
            h("span", { class: "dim small" }, `@${carer.username}`),
            h("span", { class: "spacer" }),
            h(
              "button",
              {
                class: "btn ghost small",
                type: "button",
                onClick: () =>
                  void save(carers.filter((item) => item.id !== carer.id).map((item) => item.id)),
              },
              "Remove",
            ),
          ),
        ),
      );
    }
    const assigned = new Set(carers.map((carer) => carer.id));
    const options = workers.filter((worker) => !assigned.has(worker.id));
    select.replaceChildren(
      ...(options.length === 0
        ? [h("option", { value: "" }, "No workers available")]
        : options.map((worker) =>
            h("option", { value: String(worker.id) }, worker.displayName || worker.username),
          )),
    );
    add.disabled = options.length === 0;
  }

  async function save(ids: number[]): Promise<void> {
    error.style.display = "none";
    try {
      const result = await api.put<{ carers: UserDto[] }>(`/api/rabbits/${rabbit.id}/carers`, {
        userIds: ids,
      });
      carers = result.carers;
      render();
      toast("Carers updated");
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    }
  }

  add.addEventListener("click", () => {
    if (!select.value) return;
    void save([...carers.map((carer) => carer.id), Number(select.value)]);
  });

  render();
  void api
    .get<{ users: UserDto[] }>("/api/users")
    .then(({ users }) => {
      workers = users.filter((user) => !user.isAdmin && user.active);
      render();
    })
    .catch(() => {
      add.disabled = true;
    });

  return h(
    "div",
    { class: "card" },
    h("h2", null, "Carers"),
    h("p", { class: "dim small" }, "Workers can only see and update bunnies assigned to them."),
    error,
    list,
    h("div", { class: "row wrap" }, select, add),
  );
}

function dueBadge(status: ReturnType<typeof dueStatus>): Node | null {
  if (status === "overdue") return h("span", { class: "badge alert" }, "Overdue");
  if (status === "due-soon") return h("span", { class: "badge watch" }, "Due soon");
  if (status === "ok") return h("span", { class: "badge ok" }, "OK");
  return null;
}

function nextDueDate(lastDoneAt: string | null, intervalDays: number): string | null {
  if (!lastDoneAt || intervalDays <= 0) return null;
  const date = new Date(`${lastDoneAt}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + intervalDays);
  return date.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
