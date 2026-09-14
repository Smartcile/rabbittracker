import { h } from "../dom.ts";

export type PhotoPickerHandle = {
  root: HTMLElement;
  file: () => File | null;
};

export function photoPicker(options: { label?: string; initialUrl?: string | null } = {}): PhotoPickerHandle {
  const label = options.label ?? "Add photo";
  let selected: File | null = null;
  let objectUrl: string | null = null;

  const input = h("input", { type: "file", accept: "image/*", class: "visually-hidden" });
  const preview = h("img", { class: "photo-preview", alt: "Selected photo" });
  const previewWrap = h("div", { class: "photo-preview-wrap" }, preview);
  previewWrap.style.display = "none";
  const button = h("button", { class: "btn outline small", type: "button", onClick: () => input.click() }, label);
  const remove = h(
    "button",
    { class: "btn ghost small", type: "button", onClick: () => reset() },
    "Remove",
  );

  function showPreview(url: string): void {
    preview.src = url;
    previewWrap.style.display = "";
    remove.style.display = "";
    button.textContent = "Change photo";
  }

  function reset(): void {
    selected = null;
    input.value = "";
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    preview.removeAttribute("src");
    previewWrap.style.display = "none";
    remove.style.display = "none";
    button.textContent = label;
  }

  if (options.initialUrl) showPreview(options.initialUrl);

  input.addEventListener("change", () => {
    const file = input.files?.[0] ?? null;
    if (!file) return;
    selected = file;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    showPreview(objectUrl);
  });

  const root = h("div", { class: "stack", style: { gap: "0.4rem" } }, previewWrap, h("div", { class: "row" }, button, remove), input);
  return { root, file: () => selected };
}

export function openLightbox(src: string, alt: string): void {
  const overlay = h("div", { class: "lightbox", onClick: () => overlay.remove() });
  const image = h("img", { src, alt, class: "lightbox-img" });
  overlay.append(image);
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
    }
  };
  document.addEventListener("keydown", onKeydown);
  document.body.append(overlay);
}
