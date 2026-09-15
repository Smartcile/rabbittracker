import { h } from "../dom.ts";

export type ModalHandle = {
  close: () => void;
  root: HTMLElement;
};

type InternalHandle = ModalHandle & { forceClose: () => void };

const openModals = new Set<InternalHandle>();

export function openModal(options: {
  title: string;
  body: Node;
  actions?: Node[];
  guardUnsaved?: boolean;
  beforeClose?: () => boolean | Promise<boolean>;
  onClose?: () => void;
}): ModalHandle {
  const overlay = h("div", { class: "modal-overlay" });
  const panel = h("div", { class: "modal-panel" });

  let dirty = false;
  if (options.guardUnsaved) {
    const form =
      options.body instanceof HTMLFormElement
        ? options.body
        : (options.body as HTMLElement).querySelector?.("form");
    if (form) {
      const markDirty = () => {
        dirty = true;
      };
      form.addEventListener("input", markDirty);
      form.addEventListener("change", markDirty);
      form.addEventListener("click", (event) => {
        if ((event.target as HTMLElement | null)?.closest(".toggle-btn")) dirty = true;
      });
      form.addEventListener("submit", () => {
        dirty = false;
      });
    }
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") void close();
  };

  const forceClose = () => {
    if (!openModals.has(handle)) return;
    openModals.delete(handle);
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    options.onClose?.();
  };

  const close = async () => {
    if (!openModals.has(handle)) return;
    if (options.beforeClose && !(await options.beforeClose())) return;
    if (dirty) {
      const discard = await confirmDialog({
        title: "Discard changes?",
        message: "This form has unsaved changes. Closing now will lose them.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!discard) return;
    }
    forceClose();
  };

  const handle: InternalHandle = { close: () => void close(), forceClose, root: panel };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) void close();
  });

  const children: Node[] = [
    h(
      "div",
      { class: "card-title" },
      h("h2", null, options.title),
      h("span", { class: "spacer" }),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void close(), "aria-label": "Close" },
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
  for (const modal of [...openModals]) modal.forceClose();
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
