import type { Scenario } from "@/scenarios/types";
import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type RunScenarioInput = {
  scenario: Scenario;
  openRouterKey: string;
  model: string;
  onTrace: (event: RunnerTraceEvent) => void;
};

export async function runScenario(input: RunScenarioInput): Promise<void> {
  const response = await fetch("/api/run-scenario", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: input.scenario.id,
      openRouterKey: input.openRouterKey,
      model: input.model,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("Scenario response did not include a trace stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failed = false;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as RunnerTraceEvent;
      input.onTrace(event);
      failed ||= event.type === "error";
    }

    if (done) break;
  }

  if (failed) {
    throw new Error("Scenario failed.");
  }
}
