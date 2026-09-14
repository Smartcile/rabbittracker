import type {
  CalendarSubscriptionDto,
  CalendarSyncResultDto,
  RabbitDto,
  SettingsDto,
} from "../../../shared/types.ts";
import { api } from "../api.ts";
import { rabbitAvatar } from "../components/avatar.ts";
import { confirmDialog, openModal } from "../components/modal.ts";
import { openRabbitModal } from "../components/rabbitModal.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { copyText, fmtDate, fmtTime, h } from "../dom.ts";

export function renderSettingsPage(ctx: PageContext): HTMLElement {
  return h(
    "section",
    { class: "stack" },
    h("h1", null, "Settings"),
    renderBunniesCard(),
    renderVetsCard(),
    renderListsCard(),
    renderChecklistCard(),
    renderDailyChecksCard(),
    renderSubscribeCard(),
    renderSubscriptionsCard(),
    renderExportCard(),
    renderDemoCard(),
    renderAccountCard(ctx),
    renderAboutCard(),
  );
}

function renderVetsCard(): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Vets"),
    h(
      "p",
      { class: "dim small" },
      "Keep a list of vets and clinics to pick from when logging appointments and vaccinations.",
    ),
    h("div", { class: "row" }, h("a", { class: "btn outline small", href: "#/vets" }, "Manage vets")),
  );
}

function renderDailyChecksCard(): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Daily checks"),
    h(
      "p",
      { class: "dim small" },
      "Define the daily checks you log for each bunny — poo, water, food and anything else.",
    ),
    h("div", { class: "row" }, h("a", { class: "btn outline small", href: "#/dailychecks" }, "Edit check types")),
  );
}

function renderListsCard(): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Lists"),
    h(
      "p",
      { class: "dim small" },
      "Breeds, colours, visit types, locations, vaccines, treatment routes and more — the options shown in the dropdowns.",
    ),
    h("div", { class: "row" }, h("a", { class: "btn outline small", href: "#/lookups" }, "Manage lists")),
  );
}

function renderChecklistCard(): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Health checklist"),
    h(
      "p",
      { class: "dim small" },
      "Edit the weekly checklist sections, answers and example photos shown on every health check.",
    ),
    h("div", { class: "row" }, h("a", { class: "btn outline small", href: "#/checklist" }, "Edit checklist")),
  );
}

function renderDemoCard(): HTMLElement {
  const toggle = h("input", { type: "checkbox", class: "switch", "aria-label": "Show demo data" });
  const status = h("p", { class: "dim small" });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";

  const setStatus = (enabled: boolean) => {
    status.textContent = enabled
      ? "Demo data is loaded. Turn it off to remove it."
      : "Demo data is off.";
  };

  async function load(): Promise<void> {
    const { settings } = await api.get<{ settings: SettingsDto }>("/api/settings");
    toggle.checked = settings.demoMode;
    setStatus(settings.demoMode);
  }

  toggle.addEventListener("change", async () => {
    const enabling = toggle.checked;
    error.style.display = "none";
    if (!enabling) {
      const confirmed = await confirmDialog({
        title: "Remove demo data?",
        message: "Every demo bunny and its records will be deleted. Your own data is not affected.",
        confirmLabel: "Remove",
        danger: true,
      });
      if (!confirmed) {
        toggle.checked = true;
        return;
      }
    }
    toggle.disabled = true;
    try {
      const { settings } = await api.put<{ settings: SettingsDto }>("/api/settings/demo", {
        enabled: enabling,
      });
      toggle.checked = settings.demoMode;
      setStatus(settings.demoMode);
      toast(settings.demoMode ? "Demo data loaded" : "Demo data removed");
    } catch (err) {
      toggle.checked = !enabling;
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
    } finally {
      toggle.disabled = false;
    }
  });

  void load();
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Demo data"),
    h(
      "p",
      { class: "dim small" },
      "Loads sample bunnies, records and appointments dated around the current month, so the app can be demonstrated at any time. Turning it off removes every demo bunny and its records — your own data is untouched.",
    ),
    error,
    h(
      "label",
      { class: "row", style: { gap: "0.6rem", alignItems: "center" } },
      toggle,
      h("span", null, "Show demo data"),
    ),
    status,
  );
}

function renderExportCard(): HTMLElement {
  return h(
    "div",
    { class: "card" },
    h("h2", null, "Export"),
    h(
      "p",
      { class: "dim small" },
      "The full backup is a ZIP with backup.json and every photo file — session tokens and password/PIN hashes are excluded.",
    ),
    h(
      "div",
      { class: "row wrap" },
      h("a", { class: "btn primary", href: "/api/export/backup.zip" }, "Full backup (ZIP)"),
      h("a", { class: "btn outline", href: "/api/export/backup.json" }, "JSON only"),
      h("a", { class: "btn outline", href: "/api/export/checks.csv" }, "Checks CSV"),
      h("a", { class: "btn outline", href: "/api/export/appointments.csv" }, "Appointments CSV"),
    ),
  );
}

function renderBunniesCard(): HTMLElement {
  const list = h("div");
  const add = h(
    "button",
    { class: "btn primary small", onClick: () => openRabbitModal({ onSaved: () => void load() }) },
    "Add bunny",
  );
  const card = h(
    "div",
    { class: "card" },
    h("div", { class: "card-title" }, h("h2", null, "Bunnies"), h("span", { class: "spacer" }), add),
    list,
  );

  async function load(): Promise<void> {
    const { rabbits } = await api.get<{ rabbits: RabbitDto[] }>("/api/rabbits");
    if (rabbits.length === 0) {
      list.replaceChildren(h("p", { class: "dim small" }, "No bunnies yet."));
      return;
    }
    list.replaceChildren(...rabbits.map(row));
  }

  function row(rabbit: RabbitDto): HTMLElement {
    return h(
      "div",
      { class: "list-row" },
      rabbitAvatar(rabbit, "sm"),
      h(
        "div",
        { class: "stack", style: { gap: "0" } },
        h("strong", null, rabbit.name),
        h("span", { class: "dim small" }, rabbit.status === "deceased" ? "Deceased" : "Active"),
      ),
      h("span", { class: "spacer" }),
      h(
        "button",
        {
          class: "btn ghost small",
          type: "button",
          onClick: () => openRabbitModal({ rabbit, onSaved: () => void load() }),
        },
        "Edit",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void toggleStatus(rabbit) },
        rabbit.status === "deceased" ? "Restore" : "Archive",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void remove(rabbit) },
        "Delete",
      ),
    );
  }

  async function toggleStatus(rabbit: RabbitDto): Promise<void> {
    await api.patch(`/api/rabbits/${rabbit.id}`, {
      status: rabbit.status === "deceased" ? "active" : "deceased",
    });
    toast(rabbit.status === "deceased" ? "Bunny restored" : "Bunny archived");
    await load();
  }

  async function remove(rabbit: RabbitDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete ${rabbit.name}?`,
      message: "This deletes the bunny and all of its records and photos. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/rabbits/${rabbit.id}`);
    toast("Bunny deleted");
    await load();
  }

  void load();
  return card;
}

function renderSubscribeCard(): HTMLElement {
  const content = h("div", { class: "stack" });
  const regenerate = h(
    "button",
    { class: "btn outline small", type: "button", onClick: () => void runRegenerate() },
    "New link",
  );

  async function load(): Promise<void> {
    const [{ settings }, { rabbits }] = await Promise.all([
      api.get<{ settings: SettingsDto }>("/api/settings"),
      api.get<{ rabbits: RabbitDto[] }>("/api/rabbits"),
    ]);
    const base = `${location.origin}/api/calendar/feed/${settings.feedToken}`;
    content.replaceChildren(
      h(
        "p",
        { class: "dim small" },
        "Paste a link into Google Calendar, Apple Calendar, Outlook or another app to subscribe to RabbitTracker events. Appointments, due dates, checks and treatments are included.",
      ),
      urlRow("All bunnies", `${base}.ics`),
      ...rabbits.map((rabbit) => urlRow(rabbit.name, `${base}/${rabbit.id}.ics`)),
      h(
        "p",
        { class: "dim small", style: { marginBottom: 0 } },
        "Apple Calendar: replace https:// with webcal:// in the link.",
      ),
    );
  }

  function urlRow(label: string, url: string): HTMLElement {
    const input = h("input", { readonly: true, value: url });
    input.addEventListener("focus", () => input.select());
    return h(
      "div",
      { class: "field" },
      h("label", null, label),
      h(
        "div",
        { class: "row" },
        input,
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => void copy(url) },
          "Copy",
        ),
      ),
    );
  }

  async function copy(url: string): Promise<void> {
    const ok = await copyText(url);
    toast(ok ? "Link copied" : "Could not copy the link", ok ? "info" : "error");
  }

  async function runRegenerate(): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Generate a new link?",
      message: "Calendars already subscribed with the old link will stop updating until they use the new one.",
      confirmLabel: "Generate",
      danger: true,
    });
    if (!confirmed) return;
    await api.post("/api/calendar/feed-token/regenerate");
    toast("New subscription link generated");
    await load();
  }

  void load();
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Subscribe to this calendar"),
      h("span", { class: "spacer" }),
      regenerate,
    ),
    content,
  );
}

function renderSubscriptionsCard(): HTMLElement {
  const list = h("div");
  const labelInput = h("input", { placeholder: "Vet calendar" });
  const urlInput = h("input", { placeholder: "https://… or webcal://…", autocomplete: "off" });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const add = h("button", { class: "btn primary", type: "submit" }, "Add");
  const syncAll = h(
    "button",
    { class: "btn outline small", type: "button", onClick: () => void runSyncAll() },
    "Sync all",
  );

  async function load(): Promise<void> {
    const { subscriptions } = await api.get<{ subscriptions: CalendarSubscriptionDto[] }>(
      "/api/calendar/subscriptions",
    );
    if (subscriptions.length === 0) {
      list.replaceChildren(h("p", { class: "dim small" }, "No external calendars added yet."));
      return;
    }
    list.replaceChildren(...subscriptions.map(row));
  }

  function row(subscription: CalendarSubscriptionDto): HTMLElement {
    const status = subscription.syncError
      ? `Error: ${subscription.syncError}`
      : subscription.lastSyncAt
        ? `Last sync ${fmtDate(subscription.lastSyncAt)} ${fmtTime(subscription.lastSyncAt)}`
        : "Never synced";
    return h(
      "div",
      { class: "list-row" },
      h(
        "div",
        { class: "stack", style: { gap: "0.15rem" } },
        h("strong", null, subscription.label),
        h("span", { class: "dim small" }, subscription.url),
        h(
          "span",
          { class: subscription.syncError ? "form-error small" : "dim small", style: { margin: 0 } },
          status,
        ),
      ),
      h("span", { class: "spacer" }),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void runSync(subscription) },
        "Sync now",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => openEdit(subscription) },
        "Edit",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void remove(subscription) },
        "Delete",
      ),
    );
  }

  async function runSync(subscription: CalendarSubscriptionDto): Promise<void> {
    try {
      const response = await api.post<{ result: CalendarSyncResultDto }>(
        `/api/calendar/subscriptions/${subscription.id}/sync`,
      );
      toast(
        `${subscription.label}: ${response.result.added} added, ${response.result.updated} updated, ${response.result.removed} removed`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sync failed", "error");
    }
    await load();
  }

  async function runSyncAll(): Promise<void> {
    syncAll.disabled = true;
    try {
      const response = await api.post<{ totals: CalendarSyncResultDto }>("/api/calendar/sync");
      toast(
        `Synced: ${response.totals.added} added, ${response.totals.updated} updated, ${response.totals.removed} removed`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sync failed", "error");
    } finally {
      syncAll.disabled = false;
      await load();
    }
  }

  async function remove(subscription: CalendarSubscriptionDto): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete ${subscription.label}?`,
      message: "This removes the subscription and its synced events.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await api.del(`/api/calendar/subscriptions/${subscription.id}`);
    toast("Subscription deleted");
    await load();
  }

  function openEdit(subscription: CalendarSubscriptionDto): void {
    const label = h("input", { value: subscription.label });
    const url = h("input", { value: subscription.url });
    const editError = h("p", { class: "form-error" });
    editError.style.display = "none";
    const save = h("button", { class: "btn primary", type: "submit" }, "Save");
    const modal = openModal({
      title: "Edit subscription",
      body: h(
        "form",
        {
          onSubmit: async (event: Event) => {
            event.preventDefault();
            editError.style.display = "none";
            save.disabled = true;
            try {
              await api.patch(`/api/calendar/subscriptions/${subscription.id}`, {
                label: label.value,
                url: url.value,
              });
              toast("Subscription updated");
              modal.close();
              await load();
            } catch (err) {
              editError.textContent = err instanceof Error ? err.message : "Something went wrong";
              editError.style.display = "";
            } finally {
              save.disabled = false;
            }
          },
        },
        editError,
        h("div", { class: "field" }, h("label", null, "Label"), label),
        h("div", { class: "field" }, h("label", null, "Calendar URL"), url),
        h(
          "div",
          { class: "modal-actions" },
          h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
          save,
        ),
      ),
    });
  }

  const form = h(
    "form",
    {
      onSubmit: async (event: Event) => {
        event.preventDefault();
        error.style.display = "none";
        add.disabled = true;
        try {
          await api.post("/api/calendar/subscriptions", {
            label: labelInput.value,
            url: urlInput.value,
          });
          labelInput.value = "";
          urlInput.value = "";
          toast("Calendar added");
          await load();
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : "Something went wrong";
          error.style.display = "";
        } finally {
          add.disabled = false;
        }
      },
    },
    error,
    h(
      "div",
      { class: "filters" },
      h("div", { class: "field" }, h("label", null, "Label"), labelInput),
      h("div", { class: "field" }, h("label", null, "Calendar URL"), urlInput),
    ),
    h("div", { class: "row" }, add),
  );

  void load();
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-title" },
      h("h2", null, "Calendars from other platforms"),
      h("span", { class: "spacer" }),
      syncAll,
    ),
    h(
      "p",
      { class: "dim small" },
      "Manually subscribe to ICS or webcal calendars from iCloud, Google, Outlook and other apps.",
    ),
    form,
    list,
  );
}

function renderAccountCard(ctx: PageContext): HTMLElement {
  const current = h("input", { type: "password", autocomplete: "current-password", required: true });
  const next = h("input", { type: "password", autocomplete: "new-password", required: true });
  const confirm = h("input", { type: "password", autocomplete: "new-password", required: true });
  const status = h("p", { class: "form-ok" });
  status.style.display = "none";
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const submit = h("button", { class: "btn primary", type: "submit" }, "Change password");
  const pinInput = h("input", {
    inputmode: "numeric",
    maxlength: "8",
    pattern: "\\d*",
    autocomplete: "off",
    placeholder: "4-8 digits",
  });
  const pinStatus = h("p", { class: "dim small" });
  const pinOk = h("p", { class: "form-ok" });
  pinOk.style.display = "none";
  const pinError = h("p", { class: "form-error" });
  pinError.style.display = "none";
  const savePin = h("button", { class: "btn outline small", type: "button" }, "Save PIN");
  const removePin = h("button", { class: "btn ghost small", type: "button" }, "Remove PIN");
  let hasPin = ctx.user.hasPin;

  const renderPinState = () => {
    pinStatus.textContent = hasPin
      ? "PIN sign-in is on for this account. Use it to sign in quickly on a shared device."
      : "PIN sign-in is off. Set a PIN to sign in without typing your password.";
    removePin.style.display = hasPin ? "" : "none";
  };

  savePin.addEventListener("click", async () => {
    pinOk.style.display = "none";
    pinError.style.display = "none";
    savePin.disabled = true;
    try {
      await api.put("/api/auth/pin", { pin: pinInput.value });
      hasPin = true;
      pinInput.value = "";
      pinOk.textContent = "PIN saved.";
      pinOk.style.display = "";
      renderPinState();
      await ctx.refresh();
    } catch (err) {
      pinError.textContent = err instanceof Error ? err.message : "Something went wrong";
      pinError.style.display = "";
    } finally {
      savePin.disabled = false;
    }
  });

  removePin.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Remove PIN?",
      message: "You will need your username and password to sign in again.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    pinOk.style.display = "none";
    pinError.style.display = "none";
    try {
      await api.put("/api/auth/pin", { pin: null });
      hasPin = false;
      pinOk.textContent = "PIN removed.";
      pinOk.style.display = "";
      renderPinState();
      await ctx.refresh();
    } catch (err) {
      pinError.textContent = err instanceof Error ? err.message : "Something went wrong";
      pinError.style.display = "";
    }
  });

  renderPinState();

  const form = h(
    "form",
    {
      onSubmit: async (event: Event) => {
        event.preventDefault();
        error.style.display = "none";
        status.style.display = "none";
        submit.disabled = true;
        try {
          if (next.value !== confirm.value) throw new Error("New passwords do not match");
          await api.post("/api/auth/password", { current: current.value, next: next.value });
          form.reset();
          status.textContent = "Password updated.";
          status.style.display = "";
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : "Something went wrong";
          error.style.display = "";
        } finally {
          submit.disabled = false;
        }
      },
    },
    error,
    status,
    h("div", { class: "field" }, h("label", null, "Current password"), current),
    h("div", { class: "field" }, h("label", null, "New password"), next),
    h("div", { class: "field" }, h("label", null, "Confirm new password"), confirm),
    h("div", { class: "row" }, submit),
  );

  return h(
    "div",
    { class: "card" },
    h("h2", null, "Account"),
    h("p", { class: "dim small" }, `Signed in as ${ctx.user.username}.`),
    form,
    h("h3", null, "PIN sign-in"),
    pinStatus,
    pinOk,
    pinError,
    h("div", { class: "field" }, h("label", null, "New PIN"), pinInput),
    h("div", { class: "row wrap" }, savePin, removePin),
  );
}

function renderAboutCard(): HTMLElement {
  const timezone = h("span", { class: "mono" }, "…");
  void api
    .get<{ settings: SettingsDto }>("/api/settings")
    .then(({ settings }) => {
      timezone.textContent = settings.timezone;
    })
    .catch(() => {
      timezone.textContent = "—";
    });
  return h(
    "div",
    { class: "card" },
    h("h2", null, "About"),
    h("p", { class: "dim small", style: { marginBottom: 0 } }, "Timezone: ", timezone),
  );
}
