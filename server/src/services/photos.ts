import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Metadata } from "sharp";
import { config } from "../config.ts";
import { HttpError } from "../lib/http.ts";

export type PhotoKind = "check" | "rabbit" | "checklist" | "journal" | "checklog";
export type PhotoSize = "thumb" | "full" | "orig";

export type UploadedPhoto = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export function photoDir(kind: PhotoKind, id: number): string {
  return join(config.dataDir, "photos", `${kind}-${id}`);
}

export async function savePhoto(kind: PhotoKind, id: number, file: UploadedPhoto): Promise<void> {
  let metadata: Metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    throw new HttpError(400, "Unsupported image file");
  }
  if (!metadata.width || !metadata.height) throw new HttpError(400, "Unsupported image file");

  const ext = EXT_BY_MIME[file.mimetype] ?? extensionFromName(file.originalname);
  const dir = photoDir(kind, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `orig.${ext}`), file.buffer);

  const image = sharp(file.buffer, { failOn: "none" }).rotate();
  await image
    .clone()
    .resize(320, 320, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toFile(join(dir, "thumb.jpg"));
  await image
    .clone()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(join(dir, "full.jpg"));
}

export async function deletePhotoDir(kind: PhotoKind, id: number): Promise<void> {
  await rm(photoDir(kind, id), { recursive: true, force: true });
}

export async function findPhotoFile(
  kind: PhotoKind,
  id: number,
  size: PhotoSize,
): Promise<string | null> {
  const dir = photoDir(kind, id);
  if (size === "thumb" || size === "full") {
    const file = join(dir, `${size}.jpg`);
    return (await fileExists(file)) ? file : null;
  }
  const entries = await readdir(dir).catch(() => [] as string[]);
  const orig = entries.find((entry) => entry.startsWith("orig."));
  return orig ? join(dir, orig) : null;
}

function extensionFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
