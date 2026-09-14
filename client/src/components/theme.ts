import { h } from "../dom.ts";

const SUN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';

export function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: "dark" | "light"): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("rt-theme", theme);
  } catch {
    // storage may be unavailable
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f5eee3" : "#0b0f19");
}

export function themeToggle(): HTMLButtonElement {
  const button = h("button", {
    class: "btn ghost icon-btn",
    type: "button",
    "aria-label": "Toggle light and dark theme",
    title: "Toggle light / dark",
  });
  const paint = () => {
    button.innerHTML = currentTheme() === "dark" ? SUN_ICON : MOON_ICON;
  };
  button.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
    paint();
  });
  paint();
  return button;
}
