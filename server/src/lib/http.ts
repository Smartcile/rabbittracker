import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first && first.path.length > 0 ? `${first.path.join(".")}: ` : "";
    throw new HttpError(400, first ? `${path}${first.message}` : "Invalid input");
  }
  return result.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError && (err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (typeof err === "object" && err !== null && (err as { name?: string }).name === "MulterError") {
    const code = (err as { code?: string }).code;
    res.status(400).json({ error: code === "LIMIT_FILE_SIZE" ? "File too large" : "Upload failed" });
    return;
  }
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
    res.status(409).json({ error: "Already exists" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
