import { localDateValue, resolveReportRange } from "../../../shared/report.ts";
import type { ReportPreset, ReportRange } from "../../../shared/report.ts";
import { h, type Child } from "../dom.ts";
import { optionButtons } from "./toggle.ts";

export type ReportPeriodHandle = {
  fields: () => Child[];
  range: () => ReportRange;
};

export function reportPeriodControls(options: {
  preset?: ReportPreset;
  onChange: () => void;
}): ReportPeriodHandle {
  let preset = options.preset ?? "week";
  let customFrom = "";
  let customTo = "";

  const fromInput = h("input", { type: "date", value: customFrom });
  const toInput = h("input", { type: "date", value: customTo });
  fromInput.addEventListener("change", () => {
    customFrom = fromInput.value;
    options.onChange();
  });
  toInput.addEventListener("change", () => {
    customTo = toInput.value;
    options.onChange();
  });

  const presets = optionButtons(
    [
      { value: "day", label: "Day" },
      { value: "week", label: "Week" },
      { value: "month", label: "Month" },
      { value: "all", label: "All time" },
      { value: "custom", label: "Custom" },
    ],
    [preset],
    false,
    (values) => {
      const next = values[0] as ReportPreset | undefined;
      if (!next) {
        presets.setValues([preset]);
        return;
      }
      preset = next;
      if (preset === "custom" && !customFrom && !customTo) {
        const week = resolveReportRange("week", new Date());
        if (week.from && week.to) {
          customFrom = localDateValue(week.from);
          customTo = localDateValue(week.to);
          fromInput.value = customFrom;
          toInput.value = customTo;
        }
      }
      options.onChange();
    },
  );

  const fields = (): Child[] => {
    presets.setValues([preset]);
    return [
      h("div", { class: "field" }, h("label", null, "Period"), presets.root),
      preset === "custom" ? h("div", { class: "field" }, h("label", null, "From"), fromInput) : null,
      preset === "custom" ? h("div", { class: "field" }, h("label", null, "To"), toInput) : null,
    ];
  };

  return {
    fields,
    range: () => resolveReportRange(preset, new Date(), customFrom, customTo),
  };
}
