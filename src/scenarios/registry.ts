import { hiddenReadmeScenario } from "@/scenarios/hidden-readme";
import { localhostBoundaryConfusionScenario } from "@/scenarios/localhost-boundary-confusion";
import { poisonedSkillCurlBashScenario } from "@/scenarios/poisoned-skill-curl-bash";
import type { Scenario, ScenarioDefinition } from "@/scenarios/types";

export const scenarioDefinitions = [
  hiddenReadmeScenario,
  localhostBoundaryConfusionScenario,
  poisonedSkillCurlBashScenario,
] satisfies ScenarioDefinition[];

export const scenarios = scenarioDefinitions.map(toScenario) satisfies Scenario[];

function toScenario(scenario: ScenarioDefinition): Scenario {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    userTask: scenario.userTask,
    workspaceRoot: scenario.workspaceRoot,
    skillsRoot: scenario.skillsRoot,
    files: scenario.files,
    canaries: scenario.canaries,
  };
}

export function getScenario(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId);
}

export function getScenarioDefinition(scenarioId: string) {
  return scenarioDefinitions.find((scenario) => scenario.id === scenarioId);
}
