import {
  SAFETY_MODES,
  type BenchmarkScenario,
  type RiskLevel,
  type SafetyMode,
  type ScenarioCategory,
  type TriggerType,
} from "@trust-me-bro/benchmark";

type JsonObject = Record<string, unknown>;

const scenarioCategories = [
  "credential-exfiltration",
  "prompt-injection",
  "privilege-escalation",
  "tool-misuse",
  "data-integrity",
] as const satisfies readonly ScenarioCategory[];

const riskLevels = ["low", "medium", "high"] as const satisfies readonly RiskLevel[];

const triggerTypes = [
  "file-read",
  "file-write",
  "network-call",
  "process-env",
  "privilege-boundary",
] as const satisfies readonly TriggerType[];

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function readJsonObject(
  request: Request,
): Promise<{ body: JsonObject } | { response: Response }> {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { response: jsonError("Request body must be a JSON object.") };
    }

    return { body: body as JsonObject };
  } catch {
    return { response: jsonError("Request body must be valid JSON.") };
  }
}

export function readStringArray(
  body: JsonObject,
  field: string,
): { value: string[] } | { response: Response } {
  const value = body[field];

  if (!Array.isArray(value)) {
    return { response: jsonError(`${field} must be an array of strings.`) };
  }

  if (!value.every((item): item is string => typeof item === "string")) {
    return { response: jsonError(`${field} must contain only strings.`) };
  }

  return {
    value: value.map((item) => item.trim()).filter(Boolean),
  };
}

export function readOptionalString(body: JsonObject, field: string) {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value.trim() || undefined : null;
}

export function readSafetyMode(
  body: JsonObject,
): { value: SafetyMode } | { response: Response } {
  const value = body.safetyMode;
  if (value === undefined || value === null) return { value: "warn" };

  if (
    typeof value === "string" &&
    SAFETY_MODES.includes(value as SafetyMode)
  ) {
    return { value: value as SafetyMode };
  }

  return {
    response: jsonError(
      `safetyMode must be one of: ${SAFETY_MODES.join(", ")}.`,
    ),
  };
}

export function readScenarioCategory(
  body: JsonObject,
): { value: ScenarioCategory | undefined } | { response: Response } {
  const value = body.category;
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  if (
    typeof value === "string" &&
    scenarioCategories.includes(value as ScenarioCategory)
  ) {
    return { value: value as ScenarioCategory };
  }

  return {
    response: jsonError(
      `category must be one of: ${scenarioCategories.join(", ")}.`,
    ),
  };
}

export function readGeneratedScenarios(
  body: JsonObject,
): { value: BenchmarkScenario[] } | { response: Response } {
  const value = body.generatedScenarios;
  if (value === undefined || value === null) return { value: [] };

  if (!Array.isArray(value)) {
    return { response: jsonError("generatedScenarios must be an array.") };
  }

  if (!value.every(isBenchmarkScenario)) {
    return {
      response: jsonError(
        "generatedScenarios must contain valid benchmark scenarios.",
      ),
    };
  }

  return { value };
}

function isBenchmarkScenario(value: unknown): value is BenchmarkScenario {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.version) &&
    isScenarioCategory(value.category) &&
    isRiskLevel(value.risk) &&
    isStringArrayValue(value.tags) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.userTask) &&
    isNonEmptyString(value.expectedSafeBehavior) &&
    Array.isArray(value.files) &&
    value.files.every(isScenarioFile) &&
    isHiddenTrigger(value.hiddenTrigger)
  );
}

function isScenarioFile(value: unknown) {
  return (
    isRecord(value) &&
    isNonEmptyString(value.path) &&
    typeof value.content === "string" &&
    optionalBoolean(value.sensitive) &&
    optionalBoolean(value.executable)
  );
}

function isHiddenTrigger(value: unknown) {
  return (
    isRecord(value) &&
    isTriggerType(value.type) &&
    optionalString(value.path) &&
    optionalString(value.pattern) &&
    isNonEmptyString(value.canaryId) &&
    isRiskLevel(value.sensitivity) &&
    isNonEmptyString(value.description)
  );
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isScenarioCategory(value: unknown): value is ScenarioCategory {
  return (
    typeof value === "string" &&
    scenarioCategories.includes(value as ScenarioCategory)
  );
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && riskLevels.includes(value as RiskLevel);
}

function isTriggerType(value: unknown): value is TriggerType {
  return typeof value === "string" && triggerTypes.includes(value as TriggerType);
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function optionalBoolean(value: unknown) {
  return value === undefined || typeof value === "boolean";
}
