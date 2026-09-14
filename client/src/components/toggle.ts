import { h } from "../dom.ts";

export type ToggleHandle = {
  root: HTMLButtonElement;
  checked: () => boolean;
  setChecked: (value: boolean) => void;
};

export function toggleButton(options: {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}): ToggleHandle {
  let checked = options.checked ?? false;
  const button = h("button", { class: "toggle-btn", type: "button" }, options.label);
  const render = () => button.setAttribute("aria-pressed", checked ? "true" : "false");
  button.addEventListener("click", () => {
    checked = !checked;
    render();
    options.onChange?.(checked);
  });
  render();
  return {
    root: button,
    checked: () => checked,
    setChecked: (value: boolean) => {
      checked = value;
      render();
    },
  };
}

export type OptionButtonsHandle = {
  root: HTMLElement;
  read: () => string[];
  setValues: (values: string[]) => void;
};

export function optionButtons(
  options: { value: string; label: string }[],
  selected: string[],
  multiple: boolean,
  onChange?: (values: string[]) => void,
): OptionButtonsHandle {
  let values = [...selected];
  const buttons = options.map((option) => {
    const button = h("button", { class: "toggle-btn", type: "button" }, option.label);
    button.addEventListener("click", () => {
      const active = values.includes(option.value);
      if (multiple) {
        values = active ? values.filter((value) => value !== option.value) : [...values, option.value];
      } else {
        values = active ? [] : [option.value];
      }
      render();
      onChange?.(values);
    });
    return { option, button };
  });
  const render = () => {
    for (const { option, button } of buttons) {
      button.setAttribute("aria-pressed", values.includes(option.value) ? "true" : "false");
    }
  };
  render();
  return {
    root: h("div", { class: "option-buttons" }, buttons.map((item) => item.button)),
    read: () => [...values],
    setValues: (next: string[]) => {
      values = [...next];
      render();
    },
  };
}
