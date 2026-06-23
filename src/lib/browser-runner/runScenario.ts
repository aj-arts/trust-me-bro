import type { Scenario } from "@/scenarios/types";
import { getScenarioDefinition } from "@/scenarios/registry";
import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type RunScenarioInput = {
  scenario: Scenario;
  openRouterKey: string;
  model: string;
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
    onTrace: input.onTrace,
  });
}
