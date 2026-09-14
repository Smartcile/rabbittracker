import type { RabbitDto } from "../../../shared/types.ts";
import { h } from "../dom.ts";

export function rabbitAvatar(rabbit: RabbitDto, size: "sm" | "lg" = "sm"): HTMLElement {
  const classes = `avatar avatar-${size}`;
  if (!rabbit.hasAvatar) {
    return h("span", { class: classes }, rabbit.name.slice(0, 1).toUpperCase());
  }
  return h("img", { class: classes, src: `/api/photos/rabbit/${rabbit.id}?size=thumb`, alt: rabbit.name });
}
