import type {
  CheckLogTypeDto,
  ChecklistSectionDto,
  HealthCheckDto,
  RabbitDto,
} from "../../../shared/types.ts";
import {
  DAILY_CHECK_KEY_PREFIX,
  isDailyCheckAnswerKey,
} from "../../../shared/checklist.ts";
import { formatLogNumber } from "../../../shared/checkLogs.ts";
import { formatWeight } from "../../../shared/health.ts";
import { api } from "../api.ts";
import { fmtDate, fmtTime, h } from "../dom.ts";
import { openCheckModal } from "./checkModal.ts";
import { confirmDialog } from "./modal.ts";
import { openLightbox } from "./photoPicker.ts";

export type ChecksTableOptions = {
  checks: HealthCheckDto[];
  rabbits: RabbitDto[];
  sections?: ChecklistSectionDto[];
  logTypes?: CheckLogTypeDto[];
  showRabbit?: boolean;
  timezone?: string;
  canEdit?: boolean;
  onChanged: () => void | Promise<void>;
};

export function renderChecksTable(options: ChecksTableOptions): HTMLElement {
  const rabbitNames = new Map(options.rabbits.map((rabbit) => [rabbit.id, rabbit.name]));
  const columns = options.showRabbit ? 5 : 4;
  const tbody = h("tbody");

  for (const check of options.checks) {
    const detailRow = h("tr", { class: "detail" });
    detailRow.style.display = "none";
    detailRow.append(
      h("td", { colspan: columns }, detail(check, options, () => void options.onChanged())),
    );

    const row = h(
      "tr",
      {
        class: "expandable",
        onClick: (event: Event) => {
          if ((event.target as HTMLElement).closest("button, a, img")) return;
          detailRow.style.display = detailRow.style.display === "none" ? "" : "none";
        },
      },
      h(
        "td",
        null,
        h("div", null, fmtDate(check.checkedAt, options.timezone)),
        h("div", { class: "dim small" }, fmtTime(check.checkedAt, options.timezone)),
      ),
      options.showRabbit
        ? h("td", null, rabbitNames.get(check.rabbitId) ?? `#${check.rabbitId}`)
        : null,
      h("td", { class: "mono" }, formatWeight(check.weightGrams)),
      h("td", null, statusSummary(check)),
      h(
        "td",
        null,
        h(
          "div",
          { class: "row wrap", style: { gap: "0.3rem" } },
          checklistFilled(check) ? h("span", { class: "badge" }, "Checklist") : null,
          check.hasPhoto ? h("span", { class: "badge accent" }, "Photo") : null,
        ),
      ),
    );

    tbody.append(row, detailRow);
  }

  return h(
    "div",
    { class: "tbl-wrap" },
    h(
      "table",
      { class: "tbl" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", null, "Date"),
          options.showRabbit ? h("th", null, "Bunny") : null,
          h("th", null, "Weight"),
          h("th", null, "Status"),
          h("th", null, ""),
        ),
      ),
      tbody,
    ),
  );
}

function statusSummary(check: HealthCheckDto): Node {
  const parts: string[] = [];
  if (check.appetite) parts.push(`Appetite ${check.appetite}`);
  if (check.droppings) parts.push(`Droppings ${check.droppings}`);
  if (check.energy) parts.push(`Energy ${check.energy}`);
  if (check.bodyCondition) parts.push(`Condition ${check.bodyCondition}/5`);
  if (check.temperatureTenthsC != null) parts.push(`${(check.temperatureTenthsC / 10).toFixed(1)}°C`);
  if (check.painScore != null) parts.push(`Pain ${check.painScore}/10`);
  if (parts.length === 0) return h("span", { class: "dim" }, check.notes ? "Notes" : "—");
  return h("span", { class: "small" }, parts.join(" · "));
}

function checklistFilled(check: HealthCheckDto): boolean {
  return Object.values(check.checklist ?? {}).some(
    (answer) =>
      answer.values.length > 0 ||
      answer.other.length > 0 ||
      answer.numberMilli != null ||
      (answer.text ?? "").length > 0,
  );
}

function checklistLines(
  check: HealthCheckDto,
  sections: ChecklistSectionDto[],
  logTypes: CheckLogTypeDto[],
): HTMLElement[] {
  const lines: HTMLElement[] = [];
  const answers = check.checklist ?? {};
  const covered = new Set<string>();
  for (const section of sections) {
    const answer = answers[section.key];
    if (!answer) continue;
    covered.add(section.key);
    const parts = answer.values.map(
      (value) => section.options.find((option) => option.value === value)?.label ?? value,
    );
    if (answer.other) parts.push(`Other: ${answer.other}`);
    if (parts.length > 0) lines.push(checklistLine(section.label, parts));
  }
  const typeByKey = new Map(logTypes.map((type) => [type.key, type]));
  for (const [key, answer] of Object.entries(answers)) {
    if (covered.has(key)) continue;
    const type = isDailyCheckAnswerKey(key)
      ? typeByKey.get(key.slice(DAILY_CHECK_KEY_PREFIX.length))
      : undefined;
    const label =
      type?.label ?? (isDailyCheckAnswerKey(key) ? key.slice(DAILY_CHECK_KEY_PREFIX.length) : key);
    const parts = [...answer.values];
    if (answer.numberMilli != null) parts.push(formatLogNumber(answer.numberMilli, type?.unit ?? ""));
    if (answer.text) parts.push(answer.text);
    if (answer.other) parts.push(`Other: ${answer.other}`);
    if (parts.length > 0) lines.push(checklistLine(label, parts));
  }
  return lines;
}

function checklistLine(label: string, parts: string[]): HTMLElement {
  return h(
    "div",
    { class: "checklist-line" },
    h("strong", null, label),
    h("span", null, parts.join(", ")),
  );
}

function detail(check: HealthCheckDto, options: ChecksTableOptions, refresh: () => void): Node {
  const content = h("div", { class: "stack", style: { gap: "0.6rem" } });

  if (check.notes) content.append(h("p", { style: { margin: 0 } }, check.notes));

  const lines = checklistLines(check, options.sections ?? [], options.logTypes ?? []);
  if (lines.length > 0) {
    content.append(h("div", { class: "checklist-summary" }, ...lines));
  }

  if (check.hasPhoto) {
    const image = h("img", {
      class: "photo-thumb",
      src: `/api/photos/check/${check.id}?size=thumb`,
      alt: "Check photo",
    });
    image.addEventListener("click", () =>
      openLightbox(`/api/photos/check/${check.id}?size=full`, "Check photo"),
    );
    content.append(image);
  }

  const remove = async () => {
    const confirmed = await confirmDialog({
      title: "Delete check?",
      message: "This removes the check and its photo. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/checks/${check.id}`);
    refresh();
  };

  const removePhoto = async () => {
    await api.del(`/api/checks/${check.id}/photo`);
    refresh();
  };

  if (options.canEdit ?? true) {
    content.append(
      h(
        "div",
        { class: "row wrap" },
        h(
          "button",
          {
            class: "btn outline small",
            type: "button",
            onClick: () =>
              openCheckModal({ rabbits: options.rabbits, check, onSaved: () => refresh() }),
          },
          "Edit",
        ),
        h("button", { class: "btn danger small", type: "button", onClick: () => void remove() }, "Delete"),
        check.hasPhoto
          ? h("button", { class: "btn ghost small", type: "button", onClick: () => void removePhoto() }, "Remove photo")
          : null,
      ),
    );
  }

  return content;
}
