import type { UserDto } from "../../shared/types.ts";

export type PermissionFlag =
  | "canCreateRabbits"
  | "canRecordHealth"
  | "canEditRabbits"
  | "canViewCosts"
  | "canManageCalendar"
  | "canEditFaq";

export function can(user: UserDto, flag: PermissionFlag): boolean {
  return user.isAdmin || user[flag];
}
