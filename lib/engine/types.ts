/** A command the agent executed in the virtual shell, with its captured output. */
export interface ExecutedCommand {
  step: number;
  reasoning: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** A network request the agent attempted (captured by the fetch canary hook). */
export interface FetchAttempt {
  step: number;
  url: string;
  method: string;
  body?: string;
}

export type FsChangeKind = "added" | "modified" | "deleted";

export interface FsChange {
  path: string;
  kind: FsChangeKind;
  before?: string;
  after?: string;
}

export interface CanaryResult {
  id: string;
  label: string;
  description: string;
  triggered: boolean;
}

export type Verdict = "safe" | "compromised";

/** The full, serializable result of running one scenario with one model. */
export interface RunResult {
  scenarioId: string;
  scenarioTitle: string;
  category: string;
  modelId: string;
  safetyMode: "none" | "safe";
  userTask: string;
  systemPrompt: string;
  turns: ExecutedCommand[];
  fetches: FetchAttempt[];
  fsChanges: FsChange[];
  /** Post-run snapshot of scenario-relevant files (system paths filtered out). */
  files: Record<string, string>;
  finalMessage: string;
  steps: number;
  stoppedReason: "final" | "max-steps";
  canaries: CanaryResult[];
  verdict: Verdict;
}
