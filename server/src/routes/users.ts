import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { Router } from "express";
import { userToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";
import { PERMISSION_FLAGS } from "../lib/access.ts";
import { findUserByPin, hashPassword, requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { userCreateSchema, userUpdateSchema } from "../lib/validation.ts";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(users).orderBy(users.username);
  res.json({ users: rows.map(userToDto) });
});

usersRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(userCreateSchema, req.body);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (existing.length > 0) throw new HttpError(409, "Username already taken");

  if (input.isAdmin) {
    const [user] = await db
      .insert(users)
      .values({
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        isAdmin: true,
      })
      .returning();
    res.status(201).json({ user: userToDto(user) });
    return;
  }

  const clash = await findUserByPin(input.pin);
  if (clash) throw new HttpError(409, "That PIN is already in use");
  const [user] = await db
    .insert(users)
    .values({
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(randomBytes(24).toString("hex")),
      pinHash: await hashPassword(input.pin),
      isAdmin: false,
      canCreateRabbits: input.canCreateRabbits,
      canRecordHealth: input.canRecordHealth,
      canEditRabbits: input.canEditRabbits,
      canViewCosts: input.canViewCosts,
      canManageCalendar: input.canManageCalendar,
      canEditFaq: input.canEditFaq,
    })
    .returning();
  res.status(201).json({ user: userToDto(user) });
});

usersRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid user id");
  const input = parseInput(userUpdateSchema, req.body);
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) throw new HttpError(404, "User not found");
  if (id === req.user!.id && input.active === false) {
    throw new HttpError(409, "You cannot deactivate your own account");
  }
  if (target.isAdmin && (input.isAdmin === false || input.active === false)) {
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.active, true)));
    if (adminCount <= 1) throw new HttpError(409, "Cannot remove the last admin");
  }
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.active !== undefined) patch.active = input.active;
  if (input.isAdmin !== undefined) patch.isAdmin = input.isAdmin;
  if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
  if (input.pin !== undefined) {
    if (input.pin === null) {
      patch.pinHash = null;
    } else {
      const clash = await findUserByPin(input.pin, id);
      if (clash) throw new HttpError(409, "That PIN is already in use");
      patch.pinHash = await hashPassword(input.pin);
    }
  }
  for (const flag of PERMISSION_FLAGS) {
    if (input[flag] !== undefined) patch[flag] = input[flag];
  }
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (input.active === false || input.password !== undefined) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  } else if (input.pin !== undefined && id !== req.user!.id) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }
  res.json({ user: userToDto(updated) });
});
