import { once } from "node:events";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import type { Writable } from "node:stream";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

export type BackupArchiveEntry = {
  name: string;
  path: string;
};

export async function listPhotoFiles(photosDir: string): Promise<BackupArchiveEntry[]> {
  const entries = await readdir(photosDir, { withFileTypes: true }).catch(() => []);
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const files: BackupArchiveEntry[] = [];
  for (const directory of directories) {
    const directoryPath = join(photosDir, directory.name);
    const names = await readdir(directoryPath).catch(() => []);
    for (const name of names.sort()) {
      files.push({
        name: posix.join("photos", directory.name, name),
        path: join(directoryPath, name),
      });
    }
  }
  return files;
}

export async function writeBackupZip(
  output: Writable,
  json: string,
  files: BackupArchiveEntry[],
): Promise<void> {
  let failure: Error | null = null;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  let pending: Promise<void> = Promise.resolve();
  const enqueue = (chunk: Buffer) => {
    pending = pending.then(async () => {
      if (output.destroyed) throw new Error("Backup download was interrupted");
      if (!output.write(chunk)) await once(output, "drain");
    });
  };

  const zip = new Zip((err, data, final) => {
    if (err) {
      failure = err;
      resolveDone();
      return;
    }
    if (data.length > 0) enqueue(Buffer.from(data));
    if (final) resolveDone();
  });

  try {
    const jsonEntry = new ZipDeflate("backup.json", { level: 6 });
    zip.add(jsonEntry);
    jsonEntry.push(new TextEncoder().encode(json), true);
    for (const file of files) {
      const entry = new ZipPassThrough(file.name);
      zip.add(entry);
      for await (const chunk of createReadStream(file.path)) {
        entry.push(chunk);
        await pending;
      }
      entry.push(new Uint8Array(0), true);
      await pending;
    }
    zip.end();
    await done;
    await pending;
  } catch (err) {
    zip.terminate();
    throw err instanceof Error ? err : new Error(String(err));
  }
  if (failure) throw failure;
}
