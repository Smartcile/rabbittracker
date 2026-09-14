import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNotNull } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";
import { db } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";
import type { UserRow } from "../db/schema.ts";
import { HttpError } from "./http.ts";

export const SESSION_COOKIE = "rt_session";
const SESSION_TTL_MS = config.sessionTtlMinutes * 60_000;
const SESSION_IDLE_MS = config.sessionIdleMinutes * 60_000;

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  canCreateRabbits: boolean;
  canRecordHealth: boolean;
  canEditRabbits: boolean;
  canViewCosts: boolean;
  canManageCalendar: boolean;
  canEditFaq: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function isSessionExpired(
  session: { createdAt: Date; lastSeenAt: Date },
  now: Date,
  ttlMs: number = SESSION_TTL_MS,
  idleMs: number = SESSION_IDLE_MS,
): boolean {
  return (
    now.getTime() - session.createdAt.getTime() > ttlMs ||
    now.getTime() - session.lastSeenAt.getTime() > idleMs
  );
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
  });
}

export async function createSession(userId: number): Promise<string> {
  const { token, tokenHash } = generateSessionToken();
  await db.insert(sessions).values({ tokenHash, userId });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function loadSession(req: Request): Promise<{ user: UserRow } | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.user.active || isSessionExpired(row.session, new Date())) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
  return { user: row.user };
}

async function attachSession(req: Request): Promise<boolean> {
  const session = await loadSession(req);
  if (!session) return false;
  req.user = {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    isAdmin: session.user.isAdmin,
    canCreateRabbits: session.user.canCreateRabbits,
    canRecordHealth: session.user.canRecordHealth,
    canEditRabbits: session.user.canEditRabbits,
    canViewCosts: session.user.canViewCosts,
    canManageCalendar: session.user.canManageCalendar,
    canEditFaq: session.user.canEditFaq,
  };
  return true;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!(await attachSession(req))) throw new HttpError(401, "Authentication required");
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  await attachSession(req);
  next();
}

export async function findUserByPin(pin: string, excludeUserId?: number): Promise<UserRow | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.active, true), isNotNull(users.pinHash)));
  for (const row of rows) {
    if (excludeUserId !== undefined && row.id === excludeUserId) continue;
    if (row.pinHash && (await verifyPassword(pin, row.pinHash))) return row;
  }
  return null;
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) throw new HttpError(403, "Admin access required");
  next();
}
