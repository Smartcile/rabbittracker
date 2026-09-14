import type { ChecklistSectionDto } from "../../../shared/types.ts";
import { h } from "../dom.ts";
import { openLightbox } from "./photoPicker.ts";

export function renderChecklistPhotos(section: ChecklistSectionDto): HTMLElement | null {
  if (section.photos.length === 0) return null;
  return h(
    "div",
    { class: "check-photos" },
    section.photos.map((photo) => {
      const alt = photo.caption || `${section.label} example`;
      const image = h("img", {
        class: "check-photo",
        src: `/api/photos/checklist/${photo.id}?size=thumb`,
        alt,
      });
      image.addEventListener("click", () =>
        openLightbox(`/api/photos/checklist/${photo.id}?size=full`, alt),
      );
      return h(
        "figure",
        { class: "check-photo-figure" },
        image,
        photo.caption ? h("figcaption", { class: "dim small" }, photo.caption) : null,
      );
    }),
  );
}
