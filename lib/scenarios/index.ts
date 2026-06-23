import { hiddenCurlExfil } from "./hidden-curl-exfil";
import { maliciousSetupScript } from "./malicious-setup-script";
import { injecAgentScenarios } from "./injecagent";
import { toScenarioSummary, type Scenario, type ScenarioSummary } from "./types";

/** Hand-authored scenarios, kept first so they surface at the top of the list. */
export const handwrittenScenarios: Scenario[] = [
  hiddenCurlExfil,
  maliciousSetupScript,
];

export const scenarios: Scenario[] = [
  ...handwrittenScenarios,
  ...injecAgentScenarios,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export function listScenarioSummaries(): ScenarioSummary[] {
  return scenarios.map(toScenarioSummary);
}
