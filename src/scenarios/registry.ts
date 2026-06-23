import { hiddenReadmeScenario } from "@/scenarios/cases/hidden-readme/scenario";
import type { Scenario } from "@/scenarios/types";

export const scenarios = [hiddenReadmeScenario] satisfies Scenario[];

export function getScenario(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId);
}
