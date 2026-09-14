import { and, count, eq, isNotNull } from "drizzle-orm";
import { Router } from "express";
import { userToDto } from "../api/mappers.ts";
import { config } from "../config.ts";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  findUserByPin,
  hashPassword,
  loadSession,
  readSessionToken,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  loginSchema,
  passwordChangeSchema,
  pinSchema,
  pinSetSchema,
  setupSchema,
} from "../lib/validation.ts";

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const session = await loadSession(req);
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  const [{ value: pinCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.active, true), isNotNull(users.pinHash)));
  res.json({
    user: session ? userToDto(session.user) : null,
    needsSetup: userCount === 0,
    idleMinutes: config.sessionIdleMinutes,
    pinLogin: pinCount > 0,
  });
});

authRouter.post("/pin", async (req, res) => {
  const input = parseInput(pinSchema, req.body);
  const user = await findUserByPin(input.pin);
  if (!user) throw new HttpError(401, "Incorrect PIN");
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: userToDto(user) });
});

authRouter.put("/pin", requireAuth, async (req, res) => {
  const input = parseInput(pinSetSchema, req.body);
  if (input.pin !== null) {
    const clash = await findUserByPin(input.pin, req.user!.id);
    if (clash) throw new HttpError(409, "That PIN is already in use");
  }
  const [updated] = await db
    .update(users)
    .set({
      pinHash: input.pin === null ? null : await hashPassword(input.pin),
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.user!.id))
    .returning();
  res.json({ user: userToDto(updated) });
});

authRouter.post("/setup", async (req, res) => {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) throw new HttpError(409, "Setup already completed");
  const input = parseInput(setupSchema, req.body);
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      username: input.username,
      displayName: input.displayName,
      passwordHash,
      isAdmin: true,
    })
    .returning();
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: userToDto(user) });
});

authRouter.post("/login", async (req, res) => {
  const input = parseInput(loginSchema, req.body);
  const rows = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
  const user = rows[0];
  if (!user || !user.active || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid username or password");
  }
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: userToDto(user) });
});

authRouter.post("/logout", async (req, res) => {
  const token = readSessionToken(req);
  if (token) await destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const input = parseInput(passwordChangeSchema, req.body);
  const actor = req.user!;
  const rows = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(input.current, user.passwordHash))) {
    throw new HttpError(400, "Current password is incorrect");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.next), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  res.json({ ok: true });
});
