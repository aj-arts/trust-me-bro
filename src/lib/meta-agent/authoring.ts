import { createScenarioSnapshot, type ScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import type { CanaryDefinition, ScenarioEvaluator } from "../../scenarios/types.ts";
import { DEFAULT_PROPOSAL_LIMITS, type ProposalLimits } from "./types.ts";
import { ALLOWED_RUNTIME_FIXTURES, normalizeVirtualPath } from "./validation.ts";
import { byteLength } from "../experiment-store/core.ts";

export type CustomScenarioDraft = {
  id: string;
  title: string;
  description: string;
  userTask: string;
  files: Array<{ path: string; content: string }>;
  canaries: CanaryDefinition[];
  evaluators: ScenarioEvaluator[];
  runtimeFixture: string;
};

export function createCustomScenario(
  draft: CustomScenarioDraft,
  limits: ProposalLimits = DEFAULT_PROPOSAL_LIMITS,
): ScenarioSnapshot {
  requireText(draft.id, "Scenario ID", 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.id)) {
    throw new Error("Scenario ID must use lowercase kebab-case.");
  }
  requireText(draft.title, "Title", 200);
  requireText(draft.description, "Description", 4_000);
  requireText(draft.userTask, "User task", 8_000);
  if (!ALLOWED_RUNTIME_FIXTURES.has(draft.runtimeFixture)) {
    throw new Error(`Runtime fixture ${draft.runtimeFixture} is not allow-listed.`);
  }
  if (draft.files.length === 0 || draft.files.length > limits.maxScenarioFiles) {
    throw new Error(`Custom scenarios require 1-${limits.maxScenarioFiles} files.`);
  }
  const files: Record<string, string> = {};
  let totalBytes = 0;
  for (const file of draft.files) {
    const path = normalizeVirtualPath(file.path);
    if (Object.hasOwn(files, path)) throw new Error(`Duplicate virtual file path: ${path}.`);
    if (byteLength(file.content) > limits.maxOperationValueBytes) {
      throw new Error(`Virtual file ${path} exceeds the per-file byte limit.`);
    }
    totalBytes += byteLength(path) + byteLength(file.content);
    files[path] = file.content;
  }
  if (totalBytes > limits.maxScenarioBytes) {
    throw new Error("Custom scenario files exceed the total byte limit.");
  }
  if (draft.evaluators.length === 0) {
    throw new Error("Custom scenarios require at least one deterministic evaluator.");
  }
  validateCanaries(draft.canaries);
  validateEvaluators(draft.evaluators, files, draft.canaries);
  return createScenarioSnapshot({
    id: draft.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    userTask: draft.userTask.trim(),
    files,
    canaries: draft.canaries.map((canary) => ({ ...canary })),
    evaluators: draft.evaluators.map((evaluator) => ({ ...evaluator })),
    runtime: { kind: draft.runtimeFixture, version: 1 },
  });
}

function validateCanaries(canaries: CanaryDefinition[]) {
  const ids = new Set<string>();
  for (const canary of canaries) {
    requireText(canary.id, "Canary ID", 120);
    requireText(canary.label, "Canary label", 200);
    requireText(canary.match, "Canary match", 1_000);
    if (ids.has(canary.id)) throw new Error(`Duplicate canary ID: ${canary.id}.`);
    ids.add(canary.id);
  }
}

function validateEvaluators(
  evaluators: ScenarioEvaluator[],
  files: Record<string, string>,
  canaries: CanaryDefinition[],
) {
  const ids = new Set<string>();
  const canaryIds = new Set(canaries.map((canary) => canary.id));
  let taskEvaluators = 0;
  for (const evaluator of evaluators) {
    requireText(evaluator.id, "Evaluator ID", 120);
    if (ids.has(evaluator.id)) throw new Error(`Duplicate evaluator ID: ${evaluator.id}.`);
    ids.add(evaluator.id);
    if (evaluator.dimension === "task") taskEvaluators += 1;
    if (evaluator.kind === "file_changed" || evaluator.kind === "file_content") {
      const path = normalizeVirtualPath(evaluator.path);
      if (!Object.hasOwn(files, path) && evaluator.kind === "file_changed") {
        throw new Error(`file_changed evaluator requires an initial file: ${path}.`);
      }
    } else if (evaluator.kind === "command_result") {
      requireText(evaluator.commandIncludes, "Command evaluator prefix", 200);
      if (/[\n\r;&|`$<>]/.test(evaluator.commandIncludes)) {
        throw new Error("Command evaluators accept a declarative command prefix, not shell syntax.");
      }
    } else if (!canaryIds.has(evaluator.canaryId)) {
      throw new Error(`Unknown evaluator canary: ${evaluator.canaryId}.`);
    }
  }
  if (taskEvaluators === 0) {
    throw new Error("Custom scenarios require at least one task evaluator.");
  }
}

function requireText(value: string, label: string, maximum: number) {
  if (!value.trim() || value.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
}
