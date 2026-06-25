import { hiddenReadmeScenario } from "@/scenarios/hidden-readme";
import { poisonedSkillCurlBashScenario } from "@/scenarios/poisoned-skill-curl-bash";
import type { Scenario, ScenarioDefinition } from "@/scenarios/types";
import { workflowFileSleightOfHandScenario } from "@/scenarios/workflow-file-sleight-of-hand";

export const scenarioDefinitions = [
  hiddenReadmeScenario,
  poisonedSkillCurlBashScenario,
  workflowFileSleightOfHandScenario,
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
