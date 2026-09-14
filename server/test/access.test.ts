import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { hasPermission, requirePermission } from "../src/lib/access.ts";
import type { SessionUser } from "../src/lib/auth.ts";
import { HttpError } from "../src/lib/http.ts";

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    username: "foster",
    displayName: "Foster",
    isAdmin: false,
    canCreateRabbits: false,
    canRecordHealth: true,
    canEditRabbits: false,
    canViewCosts: false,
    canManageCalendar: false,
    canEditFaq: false,
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("grants admins every permission regardless of flags", () => {
    const admin = user({ isAdmin: true, canRecordHealth: false });
    expect(hasPermission(admin, "canRecordHealth")).toBe(true);
    expect(hasPermission(admin, "canEditFaq")).toBe(true);
    expect(hasPermission(admin, "canManageCalendar")).toBe(true);
  });

  it("reads the flags for workers", () => {
    expect(hasPermission(user(), "canRecordHealth")).toBe(true);
    expect(hasPermission(user(), "canEditFaq")).toBe(false);
    expect(hasPermission(user({ canEditFaq: true }), "canEditFaq")).toBe(true);
  });
});

describe("requirePermission", () => {
  it("calls next when the worker has the flag", () => {
    const next = vi.fn();
    requirePermission("canRecordHealth")(
      { user: user() } as unknown as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws 403 when the flag is missing", () => {
    try {
      requirePermission("canEditFaq")(
        { user: user() } as unknown as Request,
        {} as Response,
        vi.fn(),
      );
      throw new Error("expected requirePermission to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(403);
    }
  });

  it("throws 401 without a user", () => {
    expect(() =>
      requirePermission("canRecordHealth")({} as Request, {} as Response, vi.fn()),
    ).toThrow(HttpError);
  });
});
