import type { UserDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { openModal } from "../components/modal.ts";
import { toast } from "../components/toast.ts";
import { toggleButton } from "../components/toggle.ts";
import type { ToggleHandle } from "../components/toggle.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

type PermissionFlag =
  | "canRecordHealth"
  | "canEditRabbits"
  | "canCreateRabbits"
  | "canViewCosts"
  | "canManageCalendar"
  | "canEditFaq";

const PERMISSIONS: { flag: PermissionFlag; label: string }[] = [
  { flag: "canRecordHealth", label: "Record health data (checks, treatments, vaccinations, care, appointments)" },
  { flag: "canEditRabbits", label: "Edit bunny profiles and photos" },
  { flag: "canCreateRabbits", label: "Add their own bunnies" },
  { flag: "canViewCosts", label: "See costs and money" },
  { flag: "canManageCalendar", label: "Manage calendar sync and feed links" },
  { flag: "canEditFaq", label: "Edit the FAQ" },
];

export function renderUsersPage(_ctx: PageContext): HTMLElement {
  const list = h("div");
  const add = h(
    "button",
    { class: "btn primary small", type: "button", onClick: () => openUserModal({ onSaved: () => void load() }) },
    "Add user",
  );
  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title" },
      h("h1", null, "Users"),
      h("span", { class: "spacer" }),
      add,
    ),
    h(
      "p",
      { class: "dim small" },
      "Admins sign in with username and password. Workers sign in with their PIN and only see the bunnies assigned to them.",
    ),
    h("div", { class: "card" }, list),
  );

  async function load(): Promise<void> {
    const { users } = await api.get<{ users: UserDto[] }>("/api/users");
    list.replaceChildren(...users.map(row));
  }

  function row(user: UserDto): HTMLElement {
    return h(
      "div",
      { class: "user-row" },
      h(
        "div",
        { class: "user-identity" },
        h("strong", null, user.displayName || user.username),
        h("span", { class: "dim small" }, `@${user.username}`),
      ),
      h(
        "div",
        { class: "user-badges" },
        h("span", { class: "badge" }, user.isAdmin ? "Admin" : "Worker"),
        user.active ? null : h("span", { class: "badge alert" }, "Inactive"),
        !user.isAdmin && user.hasPin ? h("span", { class: "badge ok" }, "PIN set") : null,
        !user.isAdmin && !user.hasPin ? h("span", { class: "badge watch" }, "No PIN") : null,
      ),
      h(
        "div",
        { class: "user-actions" },
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => openUserModal({ user, onSaved: () => void load() }) },
          "Edit",
        ),
        h(
          "button",
          { class: "btn outline small", type: "button", onClick: () => void toggleActive(user) },
          user.active ? "Deactivate" : "Activate",
        ),
      ),
    );
  }

  async function toggleActive(user: UserDto): Promise<void> {
    try {
      await api.patch(`/api/users/${user.id}`, { active: !user.active });
      toast(user.active ? "User deactivated" : "User activated");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  void load();
  return container;
}

function openUserModal(options: { user?: UserDto; onSaved: () => void }): void {
  const editing = options.user;
  const isAdmin = editing?.isAdmin ?? false;
  let role: "admin" | "worker" = isAdmin ? "admin" : "worker";

  const displayName = h("input", { name: "displayName", required: true, value: editing?.displayName ?? "" });
  const username = h("input", {
    name: "username",
    autocomplete: "off",
    autocapitalize: "none",
    spellcheck: "false",
    required: true,
    value: editing?.username ?? "",
  });
  if (editing) username.disabled = true;

  const password = h("input", { type: "password", autocomplete: "new-password" });
  const pin = h("input", {
    name: "pin",
    inputmode: "numeric",
    pattern: "\\d*",
    maxlength: "8",
    autocomplete: "off",
    placeholder: editing ? "Leave blank to keep the current PIN" : "4-8 digits",
  });
  const removePin = toggleButton({ label: "Remove PIN" });
  const active = toggleButton({ label: "Active", checked: editing?.active ?? true });

  const permissionToggles = new Map<PermissionFlag, ToggleHandle>();
  const permissionList = h(
    "div",
    { class: "option-buttons" },
    PERMISSIONS.map((permission) => {
      const toggle = toggleButton({
        label: permission.label,
        checked: editing ? editing[permission.flag] : permission.flag === "canRecordHealth",
      });
      permissionToggles.set(permission.flag, toggle);
      return toggle.root;
    }),
  );

  const roleSelect = h(
    "select",
    null,
    h("option", { value: "worker" }, "Worker (PIN sign-in)"),
    h("option", { value: "admin" }, "Admin (username and password)"),
  );
  roleSelect.value = role;
  roleSelect.disabled = Boolean(editing);

  const roleFields = h("div");
  const error = h("p", { class: "form-error" });
  error.style.display = "none";
  const save = h("button", { class: "btn primary", type: "submit" }, editing ? "Save changes" : "Add user");

  function renderRoleFields(): void {
    const parts: Node[] = [];
    password.required = !editing && role === "admin";
    pin.required = !editing && role === "worker";
    if (role === "admin") {
      parts.push(
        h(
          "div",
          { class: "field" },
          h("label", null, editing ? "New password (leave blank to keep)" : "Password"),
          password,
          h("span", { class: "dim small" }, "At least 8 characters."),
        ),
      );
    } else {
      parts.push(
        h(
          "div",
          { class: "field" },
          h("label", null, editing ? "New PIN (leave blank to keep)" : "PIN"),
          pin,
          h("span", { class: "dim small" }, "4-8 digits. Workers use this to sign in."),
        ),
      );
      if (editing) {
        parts.push(h("div", { class: "field" }, removePin.root));
      }
      parts.push(
        h("div", { class: "field" }, h("label", null, "Can do"), permissionList),
      );
    }
    if (editing) {
      parts.push(h("div", { class: "field" }, h("label", null, "Status"), active.root));
    }
    roleFields.replaceChildren(...parts);
  }

  roleSelect.addEventListener("change", () => {
    role = roleSelect.value === "admin" ? "admin" : "worker";
    renderRoleFields();
  });
  renderRoleFields();

  const modal = openModal({
    title: editing ? `Edit ${editing.displayName || editing.username}` : "Add user",
    body: h(
      "form",
      {
        onSubmit: async (event: Event) => {
          event.preventDefault();
          error.style.display = "none";
          save.disabled = true;
          try {
            if (editing) {
              const payload: Record<string, unknown> = {
                displayName: displayName.value.trim(),
                active: active.checked(),
              };
              if (role === "admin" && password.value) payload.password = password.value;
              if (role === "worker") {
                if (pin.value) payload.pin = pin.value;
                if (removePin.checked()) payload.pin = null;
                for (const permission of PERMISSIONS) {
                  payload[permission.flag] = permissionToggles.get(permission.flag)!.checked();
                }
              }
              await api.patch(`/api/users/${editing.id}`, payload);
              toast("User updated");
            } else if (role === "admin") {
              await api.post("/api/users", {
                username: username.value.trim(),
                displayName: displayName.value.trim(),
                isAdmin: true,
                password: password.value,
              });
              toast("Admin added");
            } else {
              const payload: Record<string, unknown> = {
                username: username.value.trim(),
                displayName: displayName.value.trim(),
                isAdmin: false,
                pin: pin.value,
              };
              for (const permission of PERMISSIONS) {
                payload[permission.flag] = permissionToggles.get(permission.flag)!.checked();
              }
              await api.post("/api/users", payload);
              toast("Worker added");
            }
            options.onSaved();
            modal.close();
          } catch (err) {
            error.textContent = err instanceof Error ? err.message : "Something went wrong";
            error.style.display = "";
          } finally {
            save.disabled = false;
          }
        },
      },
      error,
      h("div", { class: "field" }, h("label", null, "Display name"), displayName),
      h("div", { class: "field" }, h("label", null, "Username"), username),
      editing ? null : h("div", { class: "field" }, h("label", null, "Role"), roleSelect),
      roleFields,
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn outline", type: "button", onClick: () => modal.close() }, "Cancel"),
        save,
      ),
    ),
  });
}
