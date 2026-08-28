import type { Scenario } from "../../scenarios/types.ts";
import type { JsonValue } from "./types.ts";

export type ScenarioSnapshot = {
  schemaVersion: 1;
  revisionId: string;
  id: string;
  title: string;
  description: string;
  userTask: string;
  workspaceRoot?: string;
  skillsRoot?: string;
  files: Record<string, string>;
  canaries: Scenario["canaries"];
  runtime?: Scenario["runtime"];
  evaluators: NonNullable<Scenario["evaluators"]>;
};

export function createScenarioSnapshot(scenario: Scenario): ScenarioSnapshot {
  const snapshotContents = {
    schemaVersion: 1 as const,
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    userTask: scenario.userTask,
    workspaceRoot: scenario.workspaceRoot,
    skillsRoot: scenario.skillsRoot,
    files: sortRecord(scenario.files),
    canaries: scenario.canaries.map((canary) => ({ ...canary })),
    runtime: scenario.runtime ? { ...scenario.runtime } : undefined,
    evaluators: (scenario.evaluators ?? []).map((evaluator) => ({ ...evaluator })),
  };

  return {
    ...snapshotContents,
    revisionId: scenario.revisionId ?? `scenario-${stableHash(stableStringify(snapshotContents))}`,
  };
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortRecord(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => compareCodePoints(left, right)));
}

function sortJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    );
  }

  return String(value);
}

function compareCodePoints(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
