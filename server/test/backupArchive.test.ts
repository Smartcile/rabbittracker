import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPhotoFiles, writeBackupZip } from "../src/services/backupArchive.ts";

const photosDir = await mkdtemp(join(tmpdir(), "rabbittracker-archive-"));

async function collect(files: Awaited<ReturnType<typeof listPhotoFiles>>): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  await writeBackupZip(output, '{"version":2}', files);
  return new Uint8Array(Buffer.concat(chunks));
}

describe("backup archive", () => {
  beforeAll(async () => {
    await mkdir(join(photosDir, "check-1"), { recursive: true });
    await mkdir(join(photosDir, "journal-2"), { recursive: true });
    await writeFile(join(photosDir, "check-1", "thumb.jpg"), Buffer.from([1, 2, 3]));
    await writeFile(join(photosDir, "check-1", "orig.png"), Buffer.from([4, 5]));
    await writeFile(join(photosDir, "journal-2", "full.jpg"), Buffer.from([6]));
  });

  afterAll(async () => {
    await rm(photosDir, { recursive: true, force: true });
  });

  it("lists photo files sorted under a photos prefix", async () => {
    const files = await listPhotoFiles(photosDir);
    expect(files.map((file) => file.name)).toEqual([
      "photos/check-1/orig.png",
      "photos/check-1/thumb.jpg",
      "photos/journal-2/full.jpg",
    ]);
  });

  it("writes a zip containing the backup json and every photo", async () => {
    const archive = unzipSync(await collect(await listPhotoFiles(photosDir)));
    expect(Object.keys(archive).sort()).toEqual([
      "backup.json",
      "photos/check-1/orig.png",
      "photos/check-1/thumb.jpg",
      "photos/journal-2/full.jpg",
    ]);
    expect(new TextDecoder().decode(archive["backup.json"])).toBe('{"version":2}');
    expect(Array.from(archive["photos/check-1/thumb.jpg"] ?? [])).toEqual([1, 2, 3]);
  });

  it("returns nothing for a missing photos directory", async () => {
    expect(await listPhotoFiles(join(photosDir, "missing"))).toEqual([]);
  });
});
