import {
  ProposalValidationError,
  MUTATION_CATEGORIES,
  type MutationBudgetUsage,
  type MutationCategory,
  type OptimizationMode,
  type PromptSetOperation,
  type ProposalDraft,
  type ProposalValidationIssue,
  type ScenarioSetOperation,
} from "./types.ts";

const modes = new Set<OptimizationMode>(["red-team", "blue-team"]);
const categories = new Set<MutationCategory>(MUTATION_CATEGORIES);

export function parseStructuredProposal(output: string): ProposalDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw validationError("Proposal output is not valid JSON.", [
      {
        path: "$",
        code: "invalid_json",
        message: error instanceof Error ? error.message : "Invalid JSON.",
      },
    ]);
  }
  const issues: ProposalValidationIssue[] = [];
  if (!isRecord(parsed)) {
    throw validationError("Proposal must be a JSON object.", [
      { path: "$", code: "invalid_schema", message: "Expected an object." },
    ]);
  }
  checkKeys(
    parsed,
    [
      "schemaVersion",
      "mode",
      "category",
      "parentScenarioRevisionId",
      "parentPromptRevisionId",
      "operations",
      "rationale",
      "expectedBehavioralChange",
      "budgetUsage",
    ],
    "$",
    issues,
  );
  if (parsed.schemaVersion !== 1) issue(issues, "$.schemaVersion", "Expected schema version 1.");
  if (!modes.has(parsed.mode as OptimizationMode)) issue(issues, "$.mode", "Unknown optimization mode.");
  if (!categories.has(parsed.category as MutationCategory)) {
    issue(issues, "$.category", "Unknown mutation category.");
  }
  for (const field of [
    "parentScenarioRevisionId",
    "parentPromptRevisionId",
    "rationale",
    "expectedBehavioralChange",
  ] as const) {
    if (typeof parsed[field] !== "string" || !(parsed[field] as string).trim()) {
      issue(issues, `$.${field}`, "Expected a non-empty string.");
    }
  }
  const operations = parseOperations(parsed.operations, issues);
  const budgetUsage =
    parsed.budgetUsage === undefined ? undefined : parseBudgetUsage(parsed.budgetUsage, issues);
  if (issues.length > 0) throw validationError("Proposal failed schema validation.", issues);
  return {
    schemaVersion: 1,
    mode: parsed.mode as OptimizationMode,
    category: parsed.category as MutationCategory,
    parentScenarioRevisionId: parsed.parentScenarioRevisionId as string,
    parentPromptRevisionId: parsed.parentPromptRevisionId as string,
    operations,
    rationale: parsed.rationale as string,
    expectedBehavioralChange: parsed.expectedBehavioralChange as string,
    ...(budgetUsage ? { budgetUsage } : {}),
  };
}

function parseOperations(
  value: unknown,
  issues: ProposalValidationIssue[],
): Array<ScenarioSetOperation | PromptSetOperation> {
  if (!Array.isArray(value) || value.length === 0) {
    issue(issues, "$.operations", "Expected at least one operation.");
    return [];
  }
  return value.flatMap((entry, index) => {
    const path = `$.operations[${index}]`;
    if (!isRecord(entry)) {
      issue(issues, path, "Expected an operation object.");
      return [];
    }
    const allowed = entry.op === "delete" ? ["op", "path"] : ["op", "path", "value"];
    checkKeys(entry, allowed, path, issues);
    if (entry.op !== "set" && entry.op !== "delete") {
      issue(issues, `${path}.op`, "Operation must be set or delete.");
      return [];
    }
    if (typeof entry.path !== "string") {
      issue(issues, `${path}.path`, "Operation path must be a string.");
      return [];
    }
    if (entry.op === "delete") {
      if (!entry.path.startsWith("/files/")) {
        issue(issues, `${path}.path`, "Delete is permitted only for scenario files.");
        return [];
      }
      return [{ op: "delete" as const, path: entry.path as `/files/${string}` }];
    }
    if (typeof entry.value !== "string") {
      issue(issues, `${path}.value`, "Set operation value must be a string.");
      return [];
    }
    return [{ op: "set" as const, path: entry.path, value: entry.value }] as Array<
      ScenarioSetOperation | PromptSetOperation
    >;
  });
}

function parseBudgetUsage(value: unknown, issues: ProposalValidationIssue[]): MutationBudgetUsage {
  const fallback = { operations: 0, filesTouched: 0, bytesAdded: 0, estimatedEditDistance: 0 };
  if (!isRecord(value)) {
    issue(issues, "$.budgetUsage", "When provided, budget usage must be an object.");
    return fallback;
  }
  checkKeys(
    value,
    ["operations", "filesTouched", "bytesAdded", "estimatedEditDistance"],
    "$.budgetUsage",
    issues,
  );
  for (const field of Object.keys(fallback) as Array<keyof MutationBudgetUsage>) {
    if (!Number.isInteger(value[field]) || (value[field] as number) < 0) {
      issue(issues, `$.budgetUsage.${field}`, "Expected a non-negative integer.");
    }
  }
  return {
    operations: value.operations as number,
    filesTouched: value.filesTouched as number,
    bytesAdded: value.bytesAdded as number,
    estimatedEditDistance: value.estimatedEditDistance as number,
  };
}

function checkKeys(
  record: Record<string, unknown>,
  allowed: string[],
  path: string,
  issues: ProposalValidationIssue[],
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        code: "unknown_field",
        message: `Unknown or forbidden field "${key}".`,
      });
    }
  }
}

function issue(issues: ProposalValidationIssue[], path: string, message: string) {
  issues.push({ path, code: "invalid_schema", message });
}

function validationError(message: string, issues: ProposalValidationIssue[]) {
  return new ProposalValidationError(message, issues);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
