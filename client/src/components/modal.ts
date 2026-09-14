import { h } from "../dom.ts";

export type ModalHandle = {
  close: () => void;
  root: HTMLElement;
};

const openModals = new Set<ModalHandle>();

export function openModal(options: {
  title: string;
  body: Node;
  actions?: Node[];
  beforeClose?: () => boolean;
  onClose?: () => void;
}): ModalHandle {
  const overlay = h("div", { class: "modal-overlay" });
  const panel = h("div", { class: "modal-panel" });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  const close = () => {
    if (!openModals.has(handle)) return;
    if (options.beforeClose && !options.beforeClose()) return;
    openModals.delete(handle);
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    options.onClose?.();
  };

  const handle: ModalHandle = { close, root: panel };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  const children: Node[] = [
    h(
      "div",
      { class: "card-title" },
      h("h2", null, options.title),
      h("span", { class: "spacer" }),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: close, "aria-label": "Close" },
        "✕",
      ),
    ),
    options.body,
  ];
  if (options.actions) {
    children.push(h("div", { class: "modal-actions" }, options.actions));
  }
  panel.append(...children);
  overlay.append(panel);
  document.addEventListener("keydown", onKeydown);
  document.body.append(overlay);
  openModals.add(handle);
  return handle;
}

window.addEventListener("hashchange", () => {
  for (const modal of [...openModals]) modal.close();
});

export function confirmDialog(options: {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal: ModalHandle = openModal({
      title: options.title ?? "Confirm",
      body: h("p", null, options.message),
      actions: [
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        h(
          "button",
          {
            class: options.danger ? "btn danger" : "btn primary",
            type: "button",
            onClick: () => {
              // Resolve before close: close() fires onClose, which would otherwise cancel the confirmation.
              finish(true);
              modal.close();
            },
          },
          options.confirmLabel ?? "Confirm",
        ),
      ],
      onClose: () => finish(false),
    });
  });
}
