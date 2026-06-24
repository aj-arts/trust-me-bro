import { Bash } from "just-bash/browser";

export type BrowserSandbox = {
  bash: Bash;
};

export function createSandbox(files: Record<string, string>): BrowserSandbox {
  void files;

  const bash = new Bash();

  // File hydration belongs here once the scenario runner is implemented.
  return {
    bash,
  };
}
