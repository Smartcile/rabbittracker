import "./styles/theme.css";
import type { AuthMeDto } from "../../shared/types.ts";
import { api, setUnauthorizedHandler } from "./api.ts";
import { themeToggle } from "./components/theme.ts";
import type { PageContext } from "./context.ts";
import { h, mount } from "./dom.ts";
import { renderAuthPage } from "./pages/auth.ts";
import { renderBunniesPage } from "./pages/bunnies.ts";
import { renderCalendarPage } from "./pages/calendar.ts";
import { renderChecklistPage } from "./pages/checklist.ts";
import { renderDailyChecksPage } from "./pages/dailyChecks.ts";
import { renderDrugsPage } from "./pages/drugs.ts";
import { renderFaqPage } from "./pages/faq.ts";
import { renderHistoryPage } from "./pages/history.ts";
import { renderLookupsPage } from "./pages/lookups.ts";
import { renderHomePage } from "./pages/home.ts";
import { renderRabbitPage } from "./pages/rabbit.ts";
import { renderSettingsPage } from "./pages/settings.ts";
import { renderUsersPage } from "./pages/users.ts";
import { renderVetsPage } from "./pages/vets.ts";

function requireRoot(): HTMLElement {
  const el = document.getElementById("app");
  if (!el) throw new Error("Missing #app root element");
  return el;
}

const appRoot = requireRoot();

let me: AuthMeDto | null = null;
let lastActivity = Date.now();

const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  bunnies:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14.5" r="5.5"/><path d="M8.6 10.8 7 3.5c2.6 1 4.2 3.1 4.7 5.7"/><path d="M15.4 10.8 17 3.5c-2.6 1-4.2 3.1-4.7 5.7"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  drugs:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
  faq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h8M8 11h8"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.6c2.1.8 3.5 2.5 3.5 5.4"/></svg>',
};

const tabs = [
  { hash: "#/", label: "Home", icon: icons.home, adminOnly: false },
  { hash: "#/bunnies", label: "Bunnies", icon: icons.bunnies, adminOnly: false },
  { hash: "#/history", label: "History", icon: icons.history, adminOnly: false },
  { hash: "#/calendar", label: "Calendar", icon: icons.calendar, adminOnly: false },
  { hash: "#/drugs", label: "Drugs", icon: icons.drugs, adminOnly: false },
  { hash: "#/faq", label: "FAQ", icon: icons.faq, adminOnly: false },
  { hash: "#/users", label: "Users", icon: icons.users, adminOnly: true },
  { hash: "#/settings", label: "Settings", icon: icons.settings, adminOnly: true },
];

setUnauthorizedHandler(() => {
  me = null;
  location.hash = "#/login";
  render();
});

async function refreshMe(): Promise<void> {
  me = await api.get<AuthMeDto>("/api/auth/me");
}

async function logout(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch {
    me = null;
  }
  me = null;
  location.hash = "#/login";
  render();
}

function currentRoute(): { name: string; params: string[] } {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  return { name: parts[0] ?? "", params: parts.slice(1) };
}

function renderShell(ctx: PageContext, page: Node): HTMLElement {
  const { name } = currentRoute();
  const active = name === "" ? "#/" : name === "rabbit" ? "#/bunnies" : `#/${name}`;
  return h(
    "div",
    { class: "shell" },
    h(
      "header",
      { class: "topbar" },
      h(
        "span",
        { class: "brand" },
        h("img", { class: "brand-mark", src: "/icons/icon-192.png", alt: "" }),
        "RabbitTracker",
      ),
      h("span", { class: "spacer" }),
      themeToggle(),
      h("span", { class: "dim small hide-mobile" }, ctx.user.displayName || ctx.user.username),
      h("button", { class: "btn ghost small", onClick: () => void ctx.logout() }, "Log out"),
    ),
    h("main", { class: "page" }, page),
    h(
      "nav",
      { class: "tabs" },
      tabs
        .filter((tab) => !tab.adminOnly || ctx.user.isAdmin)
        .map((tab) => {
          const link = h("a", { href: tab.hash, class: tab.hash === active ? "active" : "" });
          link.innerHTML = `<span class="nav-ico">${tab.icon}</span><span>${tab.label}</span>`;
          return link;
        }),
    ),
  );
}

function render(): void {
  if (!me || me.needsSetup || !me.user) {
    mount(
      appRoot,
      renderAuthPage({
        needsSetup: me?.needsSetup ?? false,
        pinLogin: me?.pinLogin ?? false,
        onDone: async () => {
          await refreshMe();
          if (!location.hash || location.hash === "#/login") location.hash = "#/";
          render();
        },
      }),
    );
    return;
  }
  const ctx: PageContext = { user: me.user, refresh: refreshMe, logout };
  const { name, params } = currentRoute();
  let page: Node;
  switch (name) {
    case "settings":
      page = me.user.isAdmin ? renderSettingsPage(ctx) : renderHomePage(ctx);
      break;
    case "users":
      page = me.user.isAdmin ? renderUsersPage(ctx) : renderHomePage(ctx);
      break;
    case "checklist":
      page = me.user.isAdmin ? renderChecklistPage(ctx) : renderHomePage(ctx);
      break;
    case "vets":
      page = me.user.isAdmin ? renderVetsPage(ctx) : renderHomePage(ctx);
      break;
    case "lookups":
      page = me.user.isAdmin ? renderLookupsPage(ctx) : renderHomePage(ctx);
      break;
    case "dailychecks":
      page = me.user.isAdmin ? renderDailyChecksPage(ctx) : renderHomePage(ctx);
      break;
    case "bunnies":
      page = renderBunniesPage(ctx);
      break;
    case "rabbit": {
      const id = Number(params[0]);
      page = Number.isInteger(id) && id > 0 ? renderRabbitPage(ctx, id) : renderBunniesPage(ctx);
      break;
    }
    case "history":
      page = renderHistoryPage(ctx);
      break;
    case "calendar":
      page = renderCalendarPage(ctx);
      break;
    case "drugs":
      page = renderDrugsPage(ctx);
      break;
    case "faq":
      page = renderFaqPage(ctx);
      break;
    default:
      page = renderHomePage(ctx);
  }
  mount(appRoot, renderShell(ctx, page));
}

function noteActivity(): void {
  lastActivity = Date.now();
}

window.addEventListener("pointerdown", noteActivity);
window.addEventListener("keydown", noteActivity);
window.addEventListener("hashchange", render);

setInterval(() => {
  if (!me?.user) return;
  if (Date.now() - lastActivity > me.idleMinutes * 60_000) {
    me = null;
    location.hash = "#/login";
    render();
  }
}, 15_000);

async function boot(): Promise<void> {
  try {
    await refreshMe();
  } catch {
    me = null;
  }
  if (!location.hash) location.hash = "#/";
  render();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

void boot();
