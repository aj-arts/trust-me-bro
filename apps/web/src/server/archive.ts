import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TraceArchiveEntry } from "@trust-me-bro/benchmark";

const archiveDir = path.join(process.cwd(), ".trust-me-bro");
const archivePath = path.join(archiveDir, "traces.json");
const archiveLimit = 80;

export async function readArchive(): Promise<TraceArchiveEntry[]> {
  try {
    const raw = await readFile(archivePath, "utf8");
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
  await mkdir(archiveDir, { recursive: true });
  await writeFile(archivePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function clearArchive() {
  await rm(archivePath, { force: true });
}
