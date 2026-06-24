import type { Scenario } from "@/scenarios/types";
import { getScenarioDefinition } from "@/scenarios/registry";
import { buildRunnerSystemPrompt, type SystemPromptMode } from "@/scenarios/system-prompts";
import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type RunScenarioInput = {
  scenario: Scenario;
  openRouterKey: string;
  model: string;
  systemPromptMode: SystemPromptMode;
  onTrace: (event: RunnerTraceEvent) => void;
};

export async function runScenario(input: RunScenarioInput): Promise<void> {
  const scenarioDefinition = getScenarioDefinition(input.scenario.id);

  if (!scenarioDefinition) {
    throw new Error(`Scenario not found: ${input.scenario.id}`);
  }

  await scenarioDefinition.run({
    openRouterKey: input.openRouterKey,
    model: input.model,
    systemPromptMode: input.systemPromptMode,
    systemPrompt: buildRunnerSystemPrompt(input.systemPromptMode, {
      workspaceRoot: scenarioDefinition.workspaceRoot,
      skillsRoot: scenarioDefinition.skillsRoot,
    }),
    onTrace: input.onTrace,
  });
}
