import { bootstrapScriptAmbushScenario } from "@/scenarios/bootstrap-script-ambush";
import { forcePushHistoryRewriteScenario } from "@/scenarios/force-push-history-rewrite";
import { gitHookPoisoningScenario } from "@/scenarios/git-hook-poisoning";
import { hiddenReadmeScenario } from "@/scenarios/hidden-readme";
import { localhostBoundaryConfusionScenario } from "@/scenarios/localhost-boundary-confusion";
import { maintainerMigrationNoteScenario } from "@/scenarios/maintainer-migration-note";
import { poisonedMemoryPreferenceScenario } from "@/scenarios/poisoned-memory-preference";
import { poisonedToolCardScenario } from "@/scenarios/poisoned-tool-card";
import { poisonedSkillCurlBashScenario } from "@/scenarios/poisoned-skill-curl-bash";
import { privilegeEscalationByDelegationScenario } from "@/scenarios/privilege-escalation-by-delegation";
import { reviewCriteriaHijackScenario } from "@/scenarios/review-criteria-hijack";
import { runbookInTheLogsScenario } from "@/scenarios/runbook-in-the-logs";
import { secretExfiltrationTelemetryScenario } from "@/scenarios/secret-exfiltration-telemetry";
import { selfPoisoningArtefactLoopScenario } from "@/scenarios/self-poisoning-artefact-loop";
import { skillFileTrojanHorseScenario } from "@/scenarios/skill-file-trojan-horse";
import { sshAuthorizedKeysSeedingScenario } from "@/scenarios/ssh-authorized-keys-seeding";
import { ssrfCloudMetadataScenario } from "@/scenarios/ssrf-cloud-metadata";
import { workflowFileSleightOfHandScenario } from "@/scenarios/workflow-file-sleight-of-hand";
import type { Scenario, ScenarioDefinition } from "@/scenarios/types";

export const scenarioDefinitions = [
  bootstrapScriptAmbushScenario,
  hiddenReadmeScenario,
  localhostBoundaryConfusionScenario,
  maintainerMigrationNoteScenario,
  poisonedMemoryPreferenceScenario,
  runbookInTheLogsScenario,
  poisonedSkillCurlBashScenario,
  poisonedToolCardScenario,
  privilegeEscalationByDelegationScenario,
  reviewCriteriaHijackScenario,
  selfPoisoningArtefactLoopScenario,
  skillFileTrojanHorseScenario,
  workflowFileSleightOfHandScenario,
  secretExfiltrationTelemetryScenario,
  ssrfCloudMetadataScenario,
  gitHookPoisoningScenario,
  sshAuthorizedKeysSeedingScenario,
  forcePushHistoryRewriteScenario,
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
