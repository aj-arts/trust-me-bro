import { byteLength, type PromptSnapshot } from "../experiment-store/core.ts";
import { createScenarioSnapshot, type ScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import type { Scenario } from "../../scenarios/types.ts";
import {
  DEFAULT_PROPOSAL_LIMITS,
  ProposalValidationError,
  type ProposalLimits,
  type ProposalValidationIssue,
  type StructuredProposal,
} from "./types.ts";

export const ALLOWED_RUNTIME_FIXTURES = new Set([
  "generic",
  "bootstrap-script-ambush",
  "force-push-history-rewrite",
  "git-hook-poisoning",
  "hidden-readme",
  "localhost-boundary-confusion",
  "maintainer-migration-note",
  "poisoned-memory-preference",
  "poisoned-skill-curl-bash",
  "poisoned-tool-card",
  "privilege-escalation-by-delegation",
  "review-criteria-hijack",
  "runbook-in-the-logs",
  "secret-exfiltration-telemetry",
  "self-poisoning-artefact-loop",
  "skill-file-trojan-horse",
  "ssh-authorized-keys-seeding",
  "ssrf-cloud-metadata",
  "workflow-file-sleight-of-hand",
]);

export type ValidatedMutation = {
  scenario: ScenarioSnapshot;
  prompt: PromptSnapshot;
  editDistance: number;
  filesTouched: number;
  bytesAdded: number;
};

export function validateAndApplyProposal(input: {
  proposal: StructuredProposal;
  scenario: ScenarioSnapshot;
  prompt: PromptSnapshot;
  promptRevisionId: string;
  limits?: ProposalLimits;
}): ValidatedMutation {
  const { proposal, scenario, prompt } = input;
  const limits = input.limits ?? DEFAULT_PROPOSAL_LIMITS;
  const issues: ProposalValidationIssue[] = [];
  if (proposal.parentScenarioRevisionId !== scenario.revisionId) {
    add(issues, "$.parentScenarioRevisionId", "invalid_parent", "Scenario parent revision does not match.");
  }
  if (proposal.parentPromptRevisionId !== input.promptRevisionId) {
    add(issues, "$.parentPromptRevisionId", "invalid_parent", "Prompt parent revision does not match.");
  }
  if (proposal.operations.length > limits.maxOperations) {
    add(issues, "$.operations", "limit_exceeded", `At most ${limits.maxOperations} operations are allowed.`);
  }
  if (proposal.mode === "red-team" && proposal.operations.some(isPromptOperation)) {
    add(issues, "$.operations", "wrong_surface", "Red-team proposals may mutate only the scenario.");
  }
  if (proposal.mode === "blue-team" && proposal.operations.some((operation) => !isPromptOperation(operation))) {
    add(issues, "$.operations", "wrong_surface", "Blue-team proposals may mutate only the system prompt.");
  }

  const nextScenario = snapshotToScenario(scenario);
  let nextPrompt = prompt.systemPrompt;
  let totalValueBytes = 0;
  const touchedFiles = new Set<string>();
  let editDistance = 0;
  let bytesAdded = 0;
  for (const [index, operation] of proposal.operations.entries()) {
    const operationPath = `$.operations[${index}]`;
    if (operation.op === "set") {
      const valueBytes = byteLength(operation.value);
      totalValueBytes += valueBytes;
      if (valueBytes > limits.maxOperationValueBytes) {
        add(issues, `${operationPath}.value`, "limit_exceeded", "Operation value exceeds its byte limit.");
      }
    }
    if (isPromptOperation(operation)) {
      editDistance += estimateEditDistance(nextPrompt, operation.value);
      bytesAdded += Math.max(0, byteLength(operation.value) - byteLength(nextPrompt));
      nextPrompt = operation.value;
      continue;
    }
    if (operation.path === "/title" || operation.path === "/description" || operation.path === "/userTask") {
      if (operation.op !== "set") {
        add(issues, `${operationPath}.op`, "protected_field", "Required scenario text cannot be deleted.");
        continue;
      }
      const key = operation.path.slice(1) as "title" | "description" | "userTask";
      editDistance += estimateEditDistance(nextScenario[key], operation.value);
      bytesAdded += Math.max(0, byteLength(operation.value) - byteLength(nextScenario[key]));
      nextScenario[key] = operation.value;
      continue;
    }
    if (!operation.path.startsWith("/files/")) {
      add(
        issues,
        `${operationPath}.path`,
        "protected_field",
        "Only scenario text, files, or the system prompt may be mutated.",
      );
      continue;
    }
    const encodedPath = operation.path.slice("/files/".length);
    let filePath: string;
    try {
      filePath = normalizeVirtualPath(decodeJsonPointer(encodedPath));
    } catch (error) {
      add(
        issues,
        `${operationPath}.path`,
        "invalid_path",
        error instanceof Error ? error.message : "Invalid virtual path.",
      );
      continue;
    }
    touchedFiles.add(filePath);
    const previous = nextScenario.files[filePath] ?? "";
    const next = operation.op === "delete" ? "" : operation.value;
    editDistance += estimateEditDistance(previous, next);
    bytesAdded += Math.max(0, byteLength(next) - byteLength(previous));
    if (operation.op === "delete") delete nextScenario.files[filePath];
    else nextScenario.files[filePath] = operation.value;
  }
  if (totalValueBytes > limits.maxTotalValueBytes) {
    add(issues, "$.operations", "limit_exceeded", "Combined operation values exceed their byte limit.");
  }
  if (touchedFiles.size > limits.maxFilesTouched) {
    add(issues, "$.operations", "limit_exceeded", `At most ${limits.maxFilesTouched} files may be touched.`);
  }
  validateScenarioBoundary(nextScenario, limits, issues);
  if (byteLength(nextPrompt) > limits.maxPromptBytes) {
    add(issues, "$.operations", "limit_exceeded", "Mutated prompt exceeds its byte limit.");
  }
  const baseSize =
    proposal.mode === "blue-team"
      ? Math.max(1, prompt.systemPrompt.length)
      : Math.max(1, scenarioTextSize(scenario));
  if (editDistance > limits.maxEditDistance || editDistance / baseSize > limits.maxEditRatio) {
    add(
      issues,
      "$.operations",
      "limit_exceeded",
      `Estimated edit distance ${editDistance} exceeds the configured absolute or ratio limit.`,
    );
  }
  const actualBudget = {
    operations: proposal.operations.length,
    filesTouched: touchedFiles.size,
    bytesAdded,
    estimatedEditDistance: editDistance,
  };
  for (const key of Object.keys(actualBudget) as Array<keyof typeof actualBudget>) {
    if (proposal.budgetUsage[key] !== actualBudget[key]) {
      add(
        issues,
        `$.budgetUsage.${key}`,
        "budget_mismatch",
        `Declared ${proposal.budgetUsage[key]} but validation computed ${actualBudget[key]}.`,
      );
    }
  }
  if (issues.length > 0) {
    throw new ProposalValidationError("Proposal violates optimizer safety constraints.", issues);
  }
  return {
    scenario: createScenarioSnapshot(nextScenario),
    prompt: { ...prompt, systemPrompt: nextPrompt },
    editDistance,
    filesTouched: touchedFiles.size,
    bytesAdded,
  };
}

export function normalizeVirtualPath(value: string) {
  if (!value || value.includes("\0") || value.includes("\\") || value.startsWith("/")) {
    throw new Error("Virtual paths must be non-empty relative POSIX paths.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment === "~")) {
    throw new Error("Virtual paths cannot contain empty, dot, parent, or home segments.");
  }
  const normalized = segments.join("/");
  if (!/^[A-Za-z0-9._@+,:=-]+(?:\/[A-Za-z0-9._@+,:=-]+)*$/.test(normalized)) {
    throw new Error("Virtual path contains unsupported characters.");
  }
  return normalized;
}

function validateScenarioBoundary(
  scenario: Scenario,
  limits: ProposalLimits,
  issues: ProposalValidationIssue[],
) {
  if (Object.keys(scenario.files).length > limits.maxScenarioFiles) {
    add(issues, "$.operations", "limit_exceeded", "Scenario exceeds the file-count limit.");
  }
  const scenarioBytes = Object.entries(scenario.files).reduce(
    (sum, [path, content]) => sum + byteLength(path) + byteLength(content),
    0,
  );
  if (scenarioBytes > limits.maxScenarioBytes) {
    add(issues, "$.operations", "limit_exceeded", "Scenario files exceed the total byte limit.");
  }
  for (const path of Object.keys(scenario.files)) {
    try {
      normalizeVirtualPath(path);
    } catch (error) {
      add(
        issues,
        `$.scenario.files.${path}`,
        "invalid_path",
        error instanceof Error ? error.message : "Invalid virtual path.",
      );
    }
  }
  const runtime = scenario.runtime ?? { kind: "generic", version: 1 };
  if (!ALLOWED_RUNTIME_FIXTURES.has(runtime.kind) || runtime.version !== 1) {
    add(
      issues,
      "$.scenario.runtime",
      "unsupported_runtime",
      `Runtime fixture ${runtime.kind}@${runtime.version} is not allow-listed.`,
    );
  }
}

function snapshotToScenario(snapshot: ScenarioSnapshot): Scenario {
  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    userTask: snapshot.userTask,
    workspaceRoot: snapshot.workspaceRoot,
    skillsRoot: snapshot.skillsRoot,
    files: { ...snapshot.files },
    canaries: snapshot.canaries.map((canary) => ({ ...canary })),
    runtime: snapshot.runtime ? { ...snapshot.runtime } : undefined,
    evaluators: snapshot.evaluators.map((evaluator) => ({ ...evaluator })),
  };
}

function isPromptOperation(
  operation: StructuredProposal["operations"][number],
): operation is Extract<StructuredProposal["operations"][number], { path: "/systemPrompt" }> {
  return operation.op === "set" && operation.path === "/systemPrompt";
}

function decodeJsonPointer(value: string) {
  if (/~(?![01])/u.test(value)) throw new Error("Virtual path contains an invalid JSON Pointer escape.");
  return value.replace(/~1/g, "/").replace(/~0/g, "~");
}

function estimateEditDistance(before: string, after: string) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return Math.max(before.length - prefix - suffix, after.length - prefix - suffix);
}

function scenarioTextSize(scenario: ScenarioSnapshot) {
  return (
    scenario.title.length +
    scenario.description.length +
    scenario.userTask.length +
    Object.values(scenario.files).reduce((sum, value) => sum + value.length, 0)
  );
}

function add(
  issues: ProposalValidationIssue[],
  path: string,
  code: ProposalValidationIssue["code"],
  message: string,
) {
  issues.push({ path, code, message });
}
