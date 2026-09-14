import { resolveReportRange } from "../../../shared/report.ts";
import type { RabbitDto, ReportBundleDto } from "../../../shared/types.ts";
import { ApiError, api } from "../api.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { toggleButton } from "../components/toggle.ts";
import { fmtTime, h } from "../dom.ts";
import { renderReportSections } from "./report.ts";

const REFRESH_MS = 60_000;

let refreshTimer: number | null = null;

export function stopShareRefresh(): void {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function renderSharePage(token: string, rabbitId: number): HTMLElement {
  document.documentElement.dataset.theme = "light";
  stopShareRefresh();

  let includePhotos = false;
  let bundle: ReportBundleDto | null = null;

  const status = h("p", { class: "dim small", style: { margin: 0 } }, "Loading live report…");
  const header = h("div", { class: "card share-head" });
  const body = h("div", { class: "report-body" });

  const photosToggle = toggleButton({
    label: "Photos",
    checked: includePhotos,
    onChange: (checked) => {
      includePhotos = checked;
      renderBody();
    },
  });

  const refresh = h(
    "button",
    { class: "btn outline small", type: "button", onClick: () => void load() },
    "Refresh",
  );

  function renderHeader(rabbit: RabbitDto): void {
    header.style.display = "";
    header.replaceChildren(
      h(
        "div",
        { class: "row wrap", style: { alignItems: "flex-start" } },
        rabbitAvatar(rabbit, "lg", `&token=${encodeURIComponent(token)}`),
        h("div", { class: "stack", style: { gap: "0.25rem" } }, h("h1", { style: { margin: 0 } }, rabbit.name), status),
        h("span", { class: "spacer" }),
        h("div", { class: "row wrap" }, photosToggle.root, refresh),
      ),
    );
  }

  function renderBody(): void {
    if (!bundle) return;
    const now = new Date();
    body.replaceChildren(
      ...renderReportSections({
        bundle,
        range: resolveReportRange("all", now),
        includePhotos,
        showCost: false,
        showCarers: false,
        now,
        photoUrl: (kind, id) => `/api/photos/${kind}/${id}?size=thumb&token=${encodeURIComponent(token)}`,
      }),
    );
  }

  async function load(): Promise<void> {
    refresh.disabled = true;
    try {
      bundle = await api.get<ReportBundleDto>(
        `/api/share/${encodeURIComponent(token)}/rabbits/${rabbitId}`,
      );
      document.title = `${bundle.rabbit.name} · live report`;
      status.textContent = `Live report · updated ${fmtTime(new Date(), bundle.timezone)}`;
      renderHeader(bundle.rabbit);
      renderBody();
    } catch (err) {
      const gone = err instanceof ApiError && err.status === 404;
      header.style.display = "none";
      body.replaceChildren(
        h(
          "div",
          { class: "empty" },
          gone ? "This share link is no longer available." : "Could not load the report. Retrying…",
        ),
      );
    } finally {
      refresh.disabled = false;
    }
  }

  header.style.display = "none";
  void load();
  refreshTimer = window.setInterval(() => void load(), REFRESH_MS);

  return h("section", { class: "share-page stack" }, header, body);
}
