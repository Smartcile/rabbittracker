import { describe, expect, it } from "vitest";
import { generateSessionToken, hashToken, isSessionExpired } from "../src/lib/auth.ts";

const MINUTE = 60_000;

describe("session tokens", () => {
  it("generates a token whose hash matches hashToken", () => {
    const { token, tokenHash } = generateSessionToken();
    expect(hashToken(token)).toBe(tokenHash);
    expect(tokenHash).toHaveLength(64);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("generates unique tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("hashes deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("isSessionExpired", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const ttlMs = 7 * 24 * 60 * MINUTE;
  const idleMs = 30 * MINUTE;

  it("is false for a fresh session", () => {
    const session = { createdAt: now, lastSeenAt: now };
    expect(isSessionExpired(session, now, ttlMs, idleMs)).toBe(false);
  });

  it("is false exactly at the idle limit", () => {
    const session = { createdAt: now, lastSeenAt: new Date(now.getTime() - idleMs) };
    expect(isSessionExpired(session, now, ttlMs, idleMs)).toBe(false);
  });

  it("is true one millisecond past the idle limit", () => {
    const session = { createdAt: now, lastSeenAt: new Date(now.getTime() - idleMs - 1) };
    expect(isSessionExpired(session, now, ttlMs, idleMs)).toBe(true);
  });

  it("is false exactly at the ttl limit", () => {
    const session = { createdAt: new Date(now.getTime() - ttlMs), lastSeenAt: now };
    expect(isSessionExpired(session, now, ttlMs, idleMs)).toBe(false);
  });

  it("is true one millisecond past the ttl limit even with recent activity", () => {
    const session = { createdAt: new Date(now.getTime() - ttlMs - 1), lastSeenAt: now };
    expect(isSessionExpired(session, now, ttlMs, idleMs)).toBe(true);
  });
});
