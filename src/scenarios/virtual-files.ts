export const DEFAULT_WORKSPACE_ROOT = "/workspace";

export function toVirtualFilePath(path: string, workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  if (path.startsWith("/")) return path;

  const root = workspaceRoot.replace(/\/+$/, "");
  const relativePath = path.replace(/^\.?\//, "");

  return `${root}/${relativePath}`;
}

export function toVirtualFiles(files: Record<string, string>, workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  return Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      toVirtualFilePath(path, workspaceRoot),
      content,
    ]),
  );
}
