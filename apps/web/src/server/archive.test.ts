import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TraceArchiveEntry } from "@trust-me-bro/benchmark";
import { appendArchive, clearArchive, readArchive } from "./archive";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "trust-me-bro-archive-"));
  process.env.TRUST_ME_BRO_ARCHIVE_DIR = tempDir;
});

afterEach(async () => {
  delete process.env.TRUST_ME_BRO_ARCHIVE_DIR;
  await rm(tempDir, { force: true, recursive: true });
});

describe("local trace archive", () => {
  it("returns an empty archive when no local file exists", async () => {
    await expect(readArchive()).resolves.toEqual([]);
  });

  it("prepends new entries and replaces duplicate run IDs", async () => {
    const first = archiveEntry("RUN-1", 72);
    const second = archiveEntry("RUN-2", 85);
    const replacement = archiveEntry("RUN-1", 91);

    await appendArchive(first);
    await appendArchive(second);
    const archive = await appendArchive(replacement);

    expect(archive.map((entry) => entry.runId)).toEqual(["RUN-1", "RUN-2"]);
    expect(archive[0]?.averageScore).toBe(91);
    await expect(readArchive()).resolves.toEqual(archive);
  });

  it("uses a temp-file swap without leaving partial write artifacts", async () => {
    await appendArchive(archiveEntry("RUN-ATOMIC", 88));

    const files = await readdir(tempDir);
    expect(files).toEqual(["traces.json"]);

    const raw = await readFile(path.join(tempDir, "traces.json"), "utf8");
    expect(JSON.parse(raw)).toMatchObject([{ runId: "RUN-ATOMIC" }]);
  });

  it("falls back to an empty archive for invalid JSON", async () => {
    await writeFile(path.join(tempDir, "traces.json"), "{bad json", "utf8");

    await expect(readArchive()).resolves.toEqual([]);
  });

  it("clears only the archive file", async () => {
    await appendArchive(archiveEntry("RUN-CLEAR", 44));
    await clearArchive();

    await expect(readArchive()).resolves.toEqual([]);
    await expect(readdir(tempDir)).resolves.toEqual([]);
  });
});

function archiveEntry(runId: string, averageScore: number): TraceArchiveEntry {
  return {
    runId,
    startedAt: "2026-06-23T09:30:00.000Z",
    durationMs: 1200,
    scenarioCount: 1,
    modelCount: 1,
    safetyMode: "warn",
    averageScore,
    passRate: averageScore >= 80 ? 100 : 0,
    worstResult: averageScore >= 80 ? "pass" : "fail",
    results: [],
  };
}
