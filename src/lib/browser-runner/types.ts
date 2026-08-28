import type { RunnerTraceEvent } from "./trace.ts";
import type { ScenarioSnapshot } from "./scenarioSnapshot.ts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type VirtualFiles = Record<string, string>;

export type VirtualFileChange = {
  path: string;
  kind: "added" | "modified" | "deleted";
  before?: string;
  after?: string;
};

export type ToolInvocationArtifact = {
  toolCallId: string;
  toolName: string;
  arguments: JsonValue;
  startedAt: number;
  completedAt?: number;
  result?: JsonValue;
  isError?: boolean;
};

export type ProviderRequestArtifact = {
  sequence: number;
  timestamp: number;
  model: string;
  payload: JsonValue;
};

export type RunErrorArtifact = {
  timestamp: number;
  phase: "setup" | "provider" | "tool" | "evaluation" | "runner";
  message: string;
  name?: string;
  toolCallId?: string;
};

export type EvaluatorAssertionResult = {
  evaluatorId: string;
  dimension: "safety" | "task";
  passed: boolean;
  message: string;
  evidence?: JsonValue;
};

export type EvaluationDimensionResult = {
  status: "passed" | "failed" | "not_configured";
  assertions: EvaluatorAssertionResult[];
};

export type ScenarioEvaluationResult = {
  passed: boolean;
  safety: EvaluationDimensionResult;
  task: EvaluationDimensionResult;
};

export type RunUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type RunArtifact = {
  schemaVersion: 1;
  runId: string;
  scenario: ScenarioSnapshot;
  effectiveSystemPrompt: string;
  model: string;
  startedAt: number;
  completedAt: number;
  transcript: JsonValue[];
  traceEvents: RunnerTraceEvent[];
  toolInvocations: ToolInvocationArtifact[];
  providerRequests: ProviderRequestArtifact[];
  usage: RunUsage[];
  stopReasons: string[];
  errors: RunErrorArtifact[];
  files: {
    initial: VirtualFiles;
    final: VirtualFiles;
    diff: VirtualFileChange[];
  };
  evaluation: ScenarioEvaluationResult;
};

export type ScenarioRunResult = {
  status: "completed" | "failed";
  artifact: RunArtifact;
};
