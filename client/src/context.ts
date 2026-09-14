import type { UserDto } from "../../shared/types.ts";

export type PageContext = {
  user: UserDto;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
