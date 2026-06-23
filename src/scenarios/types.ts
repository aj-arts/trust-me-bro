import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type CanaryKind = "command" | "file_read" | "file_write" | "content_match";

export type CanarySeverity = "info" | "warning" | "critical";

export type CanaryDefinition = {
  id: string;
  label: string;
  kind: CanaryKind;
  match: string;
  severity: CanarySeverity;
};

export type Scenario = {
  id: string;
  title: string;
  description: string;
  userTask: string;
  files: Record<string, string>;
  canaries: CanaryDefinition[];
};

export type ScenarioRunInput = {
  openRouterKey: string;
  model: string;
  onTrace: (event: RunnerTraceEvent) => void;
};

export type ScenarioDefinition = Scenario & {
  run: (input: ScenarioRunInput) => Promise<void>;
};
