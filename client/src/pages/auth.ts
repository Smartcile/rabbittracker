import { api } from "../api.ts";
import { themeToggle } from "../components/theme.ts";
import { h } from "../dom.ts";

type AuthPageProps = {
  needsSetup: boolean;
  pinLogin: boolean;
  onDone: () => Promise<void>;
};

export function renderAuthPage(props: AuthPageProps): HTMLElement {
  const subtitle = h("p", { class: "dim small" });
  const body = h("div");
  let mode: "pin" | "password" = props.needsSetup || !props.pinLogin ? "password" : "pin";

  const setMode = (next: "pin" | "password") => {
    mode = next;
    renderMode();
  };

  const renderMode = () => {
    if (props.needsSetup) {
      subtitle.textContent = "Create the first admin account for your household.";
    } else if (mode === "pin") {
      subtitle.textContent = "Enter your PIN to continue.";
    } else {
      subtitle.textContent = "Sign in with your admin username and password.";
    }
    body.replaceChildren(
      mode === "pin"
        ? pinForm(props, () => setMode("password"))
        : passwordForm(props, props.pinLogin ? () => setMode("pin") : undefined),
    );
  };

  renderMode();

  const card = h(
    "div",
    { class: "card auth-card" },
    h(
      "div",
      { class: "auth-head" },
      h("img", { class: "brand-mark", src: "/icons/icon-192.png", alt: "" }),
      h("h1", null, "RabbitTracker"),
      subtitle,
    ),
    body,
  );
  return h(
    "div",
    { class: "auth-wrap" },
    h("div", { class: "auth-theme" }, themeToggle()),
    card,
  );
}

function pinForm(props: AuthPageProps, onSwitch: () => void): HTMLElement {
  let pin = "";
  const dots = h("div", { class: "pin-display" });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const submit = h("button", { class: "btn primary", type: "submit" }, "Unlock");

  const renderDots = () => {
    dots.replaceChildren(
      ...Array.from({ length: pin.length }, () => h("span", { class: "pin-dot filled" })),
    );
  };

  const press = (digit: string) => {
    if (pin.length >= 8) return;
    pin += digit;
    renderDots();
  };

  const backspace = () => {
    pin = pin.slice(0, -1);
    renderDots();
  };

  const clear = () => {
    pin = "";
    renderDots();
  };

  async function submitPin(): Promise<void> {
    if (pin.length < 4) return;
    error.style.display = "none";
    submit.disabled = true;
    try {
      await api.post("/api/auth/pin", { pin });
      await props.onDone();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Something went wrong";
      error.style.display = "";
      pin = "";
      renderDots();
    } finally {
      submit.disabled = false;
    }
  }

  const key = (digit: string) =>
    h("button", { class: "pin-key", type: "button", onClick: () => press(digit) }, digit);

  renderDots();
  return h(
    "form",
    {
      onSubmit: (event: Event) => {
        event.preventDefault();
        void submitPin();
      },
    },
    error,
    dots,
    h(
      "div",
      { class: "pin-pad" },
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key),
      h("button", { class: "pin-key subtle", type: "button", onClick: clear }, "C"),
      key("0"),
      h(
        "button",
        { class: "pin-key subtle", type: "button", onClick: backspace, "aria-label": "Backspace" },
        "⌫",
      ),
    ),
    submit,
    h(
      "button",
      { class: "btn ghost small", type: "button", onClick: onSwitch },
      "Use username and password",
    ),
  );
}

function passwordForm(props: AuthPageProps, onSwitch?: () => void): HTMLElement {
  const needsSetup = props.needsSetup;
  const username = h("input", {
    name: "username",
    autocomplete: "username",
    autocapitalize: "none",
    spellcheck: "false",
    required: true,
  });
  const displayName = h("input", { name: "displayName", autocomplete: "name" });
  const password = h("input", {
    type: "password",
    autocomplete: needsSetup ? "new-password" : "current-password",
    required: true,
  });
  const confirm = h("input", { type: "password", autocomplete: "new-password", required: true });
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const submit = h(
    "button",
    { class: "btn primary", type: "submit" },
    needsSetup ? "Create account" : "Log in",
  );

  return h(
    "form",
    {
      onSubmit: async (event: Event) => {
        event.preventDefault();
        error.style.display = "none";
        submit.disabled = true;
        try {
          if (needsSetup) {
            if (password.value !== confirm.value) throw new Error("Passwords do not match");
            await api.post("/api/auth/setup", {
              username: username.value,
              displayName: displayName.value,
              password: password.value,
            });
          } else {
            await api.post("/api/auth/login", {
              username: username.value,
              password: password.value,
            });
          }
          await props.onDone();
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : "Something went wrong";
          error.style.display = "";
        } finally {
          submit.disabled = false;
        }
      },
    },
    error,
    h("div", { class: "field" }, h("label", null, "Username"), username),
    needsSetup ? h("div", { class: "field" }, h("label", null, "Display name"), displayName) : null,
    h("div", { class: "field" }, h("label", null, "Password"), password),
    needsSetup
      ? h(
          "div",
          { class: "field" },
          h("label", null, "Confirm password"),
          confirm,
          h("span", { class: "dim small" }, "At least 8 characters."),
        )
      : null,
    h("div", { class: "row" }, submit),
    onSwitch
      ? h("button", { class: "btn ghost small", type: "button", onClick: onSwitch }, "Use PIN")
      : null,
  );
}
