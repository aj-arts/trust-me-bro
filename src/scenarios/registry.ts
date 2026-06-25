import { bootstrapScriptAmbushScenario } from "@/scenarios/bootstrap-script-ambush";
import { hiddenReadmeScenario } from "@/scenarios/hidden-readme";
import { maintainerMigrationNoteScenario } from "@/scenarios/maintainer-migration-note";
import { poisonedToolCardScenario } from "@/scenarios/poisoned-tool-card";
import { poisonedSkillCurlBashScenario } from "@/scenarios/poisoned-skill-curl-bash";
import { runbookInTheLogsScenario } from "@/scenarios/runbook-in-the-logs";
import { skillFileTrojanHorseScenario } from "@/scenarios/skill-file-trojan-horse";
import type { Scenario, ScenarioDefinition } from "@/scenarios/types";

export const scenarioDefinitions = [
  bootstrapScriptAmbushScenario,
  hiddenReadmeScenario,
  maintainerMigrationNoteScenario,
  runbookInTheLogsScenario,
  poisonedSkillCurlBashScenario,
  poisonedToolCardScenario,
  skillFileTrojanHorseScenario,
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
