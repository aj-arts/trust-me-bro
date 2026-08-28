import { buildRunnerSystemPrompt } from "../../scenarios/system-prompts";
import { createScenarioSnapshot } from "../browser-runner/scenarioSnapshot";
import { runScenario, type RunScenarioInput } from "../browser-runner/runScenario";
import type { ScenarioRunResult } from "../browser-runner/types";
import {
  createStoredRunId,
  type ExperimentRepository,
} from "./repository";

export type MetaExperimentRunInput = {
  repository: ExperimentRepository;
  experimentId: string;
  candidateId?: string;
  scenarioParentRevisionId?: string;
  promptParentRevisionId?: string;
  run: Omit<RunScenarioInput, "createRunId">;
};

export async function runMetaExperiment(
  input: MetaExperimentRunInput,
): Promise<ScenarioRunResult> {
  const runId = createStoredRunId();
  const scenario = createScenarioSnapshot(input.run.scenario);
  const effectiveSystemPrompt =
    input.run.systemPrompt ??
    buildRunnerSystemPrompt(input.run.systemPromptMode, {
      workspaceRoot: scenario.workspaceRoot,
      skillsRoot: scenario.skillsRoot,
    });
  const beginState = await input.repository.beginRun({
    runId,
    source: "experiment",
    experimentId: input.experimentId,
    candidateId: input.candidateId,
    scenario,
    scenarioParentRevisionId: input.scenarioParentRevisionId,
    effectiveSystemPrompt,
    systemPromptMode: input.run.systemPromptMode,
    promptParentRevisionId: input.promptParentRevisionId,
    model: input.run.runtime?.modelId ?? input.run.runtime?.model.id ?? input.run.model,
    startedAt: input.run.now?.() ?? Date.now(),
  });
  if (beginState === "completed") {
    const existing = await input.repository.loadRunDetail(runId);
    return { status: "completed", artifact: existing.artifact };
  }
  try {
    const result = await runScenario({
      ...input.run,
      createRunId: () => runId,
    });
    await input.repository.finishRun(result);
    return result;
  } catch (error) {
    await input.repository.abortRun(
      runId,
      error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "execution_failed",
    );
    throw error;
  }
}
