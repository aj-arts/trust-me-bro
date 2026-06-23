import type { Bash } from "just-bash";
import type { FsChange } from "./types";

/**
 * Read every file in the virtual filesystem into a plain map of path -> text.
 * Directories and unreadable/binary entries are skipped. Used to diff the repo
 * before and after an agent run.
 */
export async function snapshotFs(bash: Bash): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const paths = bash.fs.getAllPaths();
  for (const path of paths) {
    try {
      const stat = await bash.fs.stat(path);
      if (!stat.isFile) continue;
      if (stat.size > 64 * 1024) {
        snapshot[path] = `[binary or large file: ${stat.size} bytes]`;
        continue;
      }
      snapshot[path] = await bash.fs.readFile(path);
    } catch {
      // unreadable (e.g. binary, permission) — skip
    }
  }
  return snapshot;
}

/** Compute the added/modified/deleted diff between two filesystem snapshots. */
export function diffSnapshots(
  before: Record<string, string>,
  after: Record<string, string>,
): FsChange[] {
  const changes: FsChange[] = [];
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const path of paths) {
    const had = path in before;
    const has = path in after;
    if (had && has) {
      if (before[path] !== after[path]) {
        changes.push({ path, kind: "modified", before: before[path], after: after[path] });
      }
    } else if (!had && has) {
      changes.push({ path, kind: "added", after: after[path] });
    } else if (had && !has) {
      changes.push({ path, kind: "deleted", before: before[path] });
    }
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
