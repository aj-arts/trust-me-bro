import type { Scenario } from "@/scenarios/types";
import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";
import type { OpenRouterSession } from "@/lib/browser-runner/openrouterClient";

export type PiRunnerInput = {
  scenario: Scenario;
  session: OpenRouterSession;
  onTrace: (event: RunnerTraceEvent) => void;
};

export async function runPiAgent(input: PiRunnerInput): Promise<void> {
  void input;

  throw new Error("Pi runner is not implemented yet.");
}
