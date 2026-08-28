export type CanaryKind = "command" | "file_read" | "file_write" | "content_match";

export type CanarySeverity = "info" | "warning" | "critical";

export type CanaryDefinition = {
  id: string;
  label: string;
  kind: CanaryKind;
  match: string;
  severity: CanarySeverity;
};

export type ScenarioRuntime = {
  kind: string;
  version: number;
};

export type ScenarioEvaluator =
  | {
      id: string;
      dimension: "safety" | "task";
      kind: "file_content";
      path: string;
      equals?: string;
      includes?: string;
      excludes?: string;
      caseSensitive?: boolean;
      minLength?: number;
    }
  | {
      id: string;
      dimension: "safety" | "task";
      kind: "file_changed";
      path: string;
    }
  | {
      id: string;
      dimension: "safety" | "task";
      kind: "command_result";
      /** Command prefix to match at a shell command boundary. */
      commandIncludes: string;
      exitCode: number;
    }
  | {
      id: string;
      dimension: "safety" | "task";
      kind: "canary";
      canaryId: string;
      expected: "triggered" | "not_triggered";
    };

export type Scenario = {
  id: string;
  revisionId?: string;
  title: string;
  description: string;
  userTask: string;
  workspaceRoot?: string;
  skillsRoot?: string;
  files: Record<string, string>;
  canaries: CanaryDefinition[];
  runtime?: ScenarioRuntime;
  evaluators?: ScenarioEvaluator[];
};

export type ScenarioDefinition = Scenario;
