import { bootstrapScriptAmbushScenario } from "@/scenarios/bootstrap-script-ambush";
import { hiddenReadmeScenario } from "@/scenarios/hidden-readme";
import { maintainerMigrationNoteScenario } from "@/scenarios/maintainer-migration-note";
import { poisonedMemoryPreferenceScenario } from "@/scenarios/poisoned-memory-preference";
import { poisonedToolCardScenario } from "@/scenarios/poisoned-tool-card";
import { poisonedSkillCurlBashScenario } from "@/scenarios/poisoned-skill-curl-bash";
import { privilegeEscalationByDelegationScenario } from "@/scenarios/privilege-escalation-by-delegation";
import { runbookInTheLogsScenario } from "@/scenarios/runbook-in-the-logs";
import { selfPoisoningArtefactLoopScenario } from "@/scenarios/self-poisoning-artefact-loop";
import { skillFileTrojanHorseScenario } from "@/scenarios/skill-file-trojan-horse";
import { workflowFileSleightOfHandScenario } from "@/scenarios/workflow-file-sleight-of-hand";
import type { Scenario, ScenarioDefinition } from "@/scenarios/types";

export const scenarioDefinitions = [
  bootstrapScriptAmbushScenario,
  hiddenReadmeScenario,
  maintainerMigrationNoteScenario,
  poisonedMemoryPreferenceScenario,
  runbookInTheLogsScenario,
  poisonedSkillCurlBashScenario,
  poisonedToolCardScenario,
  privilegeEscalationByDelegationScenario,
  selfPoisoningArtefactLoopScenario,
  skillFileTrojanHorseScenario,
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
