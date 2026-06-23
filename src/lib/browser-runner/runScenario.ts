import type { Scenario } from "@/scenarios/types";
import { createOpenRouterSession } from "@/lib/browser-runner/openrouterClient";
import { createTraceEvent, type RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type RunScenarioInput = {
  scenario: Scenario;
  openRouterKey: string;
  model: string;
  onTrace: (event: RunnerTraceEvent) => void;
};

export async function runScenario(input: RunScenarioInput): Promise<void> {
  createOpenRouterSession({
    apiKey: input.openRouterKey,
    model: input.model,
  });

  input.onTrace(
    createTraceEvent(0, "status", "Browser runner scaffold is ready for implementation."),
  );
}
