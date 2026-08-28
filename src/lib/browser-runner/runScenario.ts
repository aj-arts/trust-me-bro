import { buildRunnerSystemPrompt, type SystemPromptMode } from "../../scenarios/system-prompts.ts";
import type { Scenario } from "../../scenarios/types.ts";
import { toVirtualFiles } from "../../scenarios/virtual-files.ts";
import { diffVirtualFiles } from "./createSandbox.ts";
import { evaluateScenario } from "./evaluators.ts";
import { createOpenRouterSession } from "./openrouterClient.ts";
import { runPiAgent, type PiRunnerRuntime } from "./piRunner.ts";
import { createScenarioSnapshot } from "./scenarioSnapshot.ts";
import { createTraceRecorder, type RunnerTraceEvent } from "./trace.ts";
import type { RunArtifact, ScenarioRunResult } from "./types.ts";

export type RunScenarioInput = {
  scenario: Scenario;
  openRouterKey?: string;
  model: string;
  systemPromptMode: SystemPromptMode;
  systemPrompt?: string;
  maxOutputTokens?: number;
  onTrace?: (event: RunnerTraceEvent) => void;
  runtime?: PiRunnerRuntime;
  now?: () => number;
  createRunId?: () => string;
};

export async function runScenario(input: RunScenarioInput): Promise<ScenarioRunResult> {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const scenario = createScenarioSnapshot(input.scenario);
  const effectiveSystemPrompt =
    input.systemPrompt ??
    buildRunnerSystemPrompt(input.systemPromptMode, {
      workspaceRoot: scenario.workspaceRoot,
      skillsRoot: scenario.skillsRoot,
    });
  const trace = createTraceRecorder(input.onTrace, now);
  let result;

  try {
    const session = input.runtime
      ? undefined
      : createOpenRouterSession({
          apiKey: input.openRouterKey ?? "",
          model: input.model,
          maxTokens: input.maxOutputTokens,
        });
    result = await runPiAgent({
      scenario,
      effectiveSystemPrompt,
      trace,
      runtime: input.runtime,
      session,
      now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace.emit("error", message);
    const files = toVirtualFiles(scenario.files, scenario.workspaceRoot);
    result = {
      transcript: [],
      toolInvocations: [],
      providerRequests: [],
      usage: [],
      stopReasons: [],
      errors: [
        {
          timestamp: now(),
          phase: "setup" as const,
          message,
          name: error instanceof Error ? error.name : undefined,
        },
      ],
      initialFiles: files,
      finalFiles: files,
      triggeredCanaryIds: new Set<string>(),
    };
  }
  const evaluation = evaluateScenario({
    scenario,
    initialFiles: result.initialFiles,
    finalFiles: result.finalFiles,
    toolInvocations: result.toolInvocations,
    triggeredCanaryIds: result.triggeredCanaryIds,
  });
  const completedAt = now();
  const artifact: RunArtifact = {
    schemaVersion: 1,
    runId: input.createRunId?.() ?? createRunId(startedAt),
    scenario,
    effectiveSystemPrompt,
    model: input.runtime?.modelId ?? input.runtime?.model.id ?? input.model,
    startedAt,
    completedAt,
    transcript: result.transcript,
    traceEvents: [...trace.events],
    toolInvocations: result.toolInvocations,
    providerRequests: result.providerRequests,
    usage: result.usage,
    stopReasons: result.stopReasons,
    errors: result.errors,
    files: {
      initial: result.initialFiles,
      final: result.finalFiles,
      diff: diffVirtualFiles(result.initialFiles, result.finalFiles),
    },
    evaluation,
  };
  const failed =
    result.errors.some(
      (error) =>
        error.phase === "setup" || error.phase === "provider" || error.phase === "runner",
    ) ||
    result.stopReasons.some((reason) => reason === "error" || reason === "aborted");

  return {
    status: failed ? "failed" : "completed",
    artifact,
  };
}

function createRunId(timestamp: number) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run-${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}
