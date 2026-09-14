import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db/index.ts";
import { rabbitCarers, rabbits } from "../db/schema.ts";
import type { RabbitRow } from "../db/schema.ts";
import type { SessionUser } from "./auth.ts";
import { HttpError } from "./http.ts";

export const PERMISSION_FLAGS = [
  "canCreateRabbits",
  "canRecordHealth",
  "canEditRabbits",
  "canViewCosts",
  "canManageCalendar",
  "canEditFaq",
] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

export function hasPermission(user: SessionUser, flag: PermissionFlag): boolean {
  return user.isAdmin || user[flag];
}

export function requirePermission(flag: PermissionFlag) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) throw new HttpError(401, "Authentication required");
    if (!hasPermission(user, flag)) {
      throw new HttpError(403, "You do not have permission to do that");
    }
    next();
  };
}

export function hideCosts(user: SessionUser): boolean {
  return !user.isAdmin && !user.canViewCosts;
}

export function visibleRabbitIds(user: SessionUser) {
  return db
    .select({ id: rabbitCarers.rabbitId })
    .from(rabbitCarers)
    .where(eq(rabbitCarers.userId, user.id));
}

export async function findVisibleRabbit(user: SessionUser, id: number): Promise<RabbitRow> {
  const rows = await db.select().from(rabbits).where(eq(rabbits.id, id)).limit(1);
  const rabbit = rows[0];
  if (!rabbit) throw new HttpError(404, "Rabbit not found");
  if (!user.isAdmin) {
    const link = await db
      .select({ rabbitId: rabbitCarers.rabbitId })
      .from(rabbitCarers)
      .where(and(eq(rabbitCarers.rabbitId, id), eq(rabbitCarers.userId, user.id)))
      .limit(1);
    if (!link[0]) throw new HttpError(404, "Rabbit not found");
  }
  return rabbit;
}
