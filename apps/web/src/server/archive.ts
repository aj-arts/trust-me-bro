import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TraceArchiveEntry } from "@trust-me-bro/benchmark";

const archiveDirName = ".trust-me-bro";
const archiveFileName = "traces.json";
const archiveLimit = 80;

export async function readArchive(): Promise<TraceArchiveEntry[]> {
  try {
    const raw = await readFile(archivePath(), "utf8");
    const parsed = JSON.parse(raw) as TraceArchiveEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendArchive(entry: TraceArchiveEntry) {
  const current = await readArchive();
  const next = [entry, ...current.filter((item) => item.runId !== entry.runId)].slice(
    0,
    archiveLimit,
  );
  const dir = archiveDir();
  const targetPath = archivePath();
  const tempPath = archiveTempPath();

  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, targetPath);

  return next;
}

export async function clearArchive() {
  await rm(archivePath(), { force: true });
}

function archiveDir() {
  const configured = process.env.TRUST_ME_BRO_ARCHIVE_DIR;
  return configured ? path.resolve(configured) : path.join(process.cwd(), archiveDirName);
}

function archivePath() {
  return path.join(archiveDir(), archiveFileName);
}

function archiveTempPath() {
  return path.join(
    archiveDir(),
    `${archiveFileName}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );
}
