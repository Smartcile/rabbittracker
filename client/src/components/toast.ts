import { h } from "../dom.ts";

let host: HTMLElement | null = null;

function getHost(): HTMLElement {
  if (!host) {
    host = h("div", { class: "toast-host" });
    document.body.append(host);
  }
  return host;
}

export function toast(message: string, kind: "info" | "error" = "info"): void {
  const element = h("div", { class: `toast${kind === "error" ? " error" : ""}` }, message);
  getHost().append(element);
  window.setTimeout(() => element.remove(), 3200);
}
