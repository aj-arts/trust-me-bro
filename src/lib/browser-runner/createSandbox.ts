import { Bash, type BashOptions } from "just-bash/browser";
import { toVirtualFiles } from "../../scenarios/virtual-files.ts";
import type { VirtualFileChange, VirtualFiles } from "./types.ts";

const VIRTUAL_SYMLINK_PREFIX = "\u0000trust-me-bro:symlink:";

export type BrowserSandbox = {
  bash: Bash;
  workspaceRoot: string;
};

export type CreateSandboxOptions = Omit<BashOptions, "cwd" | "files"> & {
  workspaceRoot: string;
  files: Record<string, string>;
};

export function createSandbox(options: CreateSandboxOptions): BrowserSandbox {
  const bash = new Bash({
    ...options,
    cwd: options.workspaceRoot,
    files: toVirtualFiles(options.files, options.workspaceRoot),
  });

  return {
    bash,
    workspaceRoot: options.workspaceRoot,
  };
}

export async function snapshotSandboxFiles(sandbox: BrowserSandbox): Promise<VirtualFiles> {
  const files: VirtualFiles = {};
  const paths = [...sandbox.bash.fs.getAllPaths()].sort();

  for (const path of paths) {
    const stat = await sandbox.bash.fs.lstat(path);
    if (stat.isSymbolicLink) {
      files[path] = `${VIRTUAL_SYMLINK_PREFIX}${await sandbox.bash.fs.readlink(path)}`;
      continue;
    }
    if (stat.isFile) {
      files[path] = await sandbox.bash.fs.readFile(path);
    }
  }

  return files;
}

export function isVirtualSymlink(value: string | undefined) {
  return value?.startsWith(VIRTUAL_SYMLINK_PREFIX) ?? false;
}

export function diffVirtualFiles(
  initial: VirtualFiles,
  final: VirtualFiles,
): VirtualFileChange[] {
  const paths = Array.from(new Set([...Object.keys(initial), ...Object.keys(final)])).sort();
  const changes: VirtualFileChange[] = [];

  for (const path of paths) {
    const before = initial[path];
    const after = final[path];
    if (before === after) continue;
    if (before === undefined) changes.push({ path, kind: "added", after });
    else if (after === undefined) changes.push({ path, kind: "deleted", before });
    else changes.push({ path, kind: "modified", before, after });
  }

  return changes;
}
