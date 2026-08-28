import { isSensitivePersistenceKey, toRedactedJson } from "../browser-runner/redaction.ts";
import { stableStringify, type ScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import type { JsonValue, RunArtifact } from "../browser-runner/types.ts";
import type { SystemPromptMode } from "../../scenarios/system-prompts.ts";

export const ARTIFACT_CHUNK_MAX_BYTES = 48 * 1024;
export const ARTIFACT_MAX_BYTES = 4 * 1024 * 1024;
export const ARTIFACT_MAX_CHUNKS = 96;
export const REVISION_MAX_BYTES = 512 * 1024;

export function assertMetaAgentLabEnabled(
  enabled = runtimeEnvironment().META_AGENT_LAB_LOCAL_ONLY === "true",
) {
  if (!enabled) {
    throw new Error(
      "Meta-agent persistence is disabled unless META_AGENT_LAB_LOCAL_ONLY=true in a trusted single-user deployment.",
    );
  }
}

function runtimeEnvironment(): Record<string, string | undefined> {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.process?.env ?? {};
}

export type ExperimentStatus = "draft" | "running" | "completed" | "failed" | "cancelled";
export type CandidateStatus = "proposed" | "accepted" | "rejected";
export type StoredRunStatus = "running" | "completed" | "failed";
export type RunSource = "benchmark" | "experiment";

export type PromptSnapshot = {
  schemaVersion: 1;
  systemPrompt: string;
  systemPromptMode: SystemPromptMode;
};

export type PreparedRevision<T> = {
  revisionId: string;
  contentHash: string;
  snapshot: T;
  snapshotJson: string;
  byteLength: number;
};

export type ArtifactChunk = {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  byteLength: number;
  contentHash: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const SECRET_VALUE =
  /\bsk-or-v1-[A-Za-z0-9_-]+\b|\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i;
const SENSITIVE_JSON_KEY =
  /"(?:authorization|proxy[-_]?authorization|x[-_]?api[-_]?key|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|cookie|set[-_]?cookie|password|secret|token)"\s*:/i;

export async function prepareScenarioRevision(
  snapshot: ScenarioSnapshot,
): Promise<PreparedRevision<ScenarioSnapshot>> {
  const snapshotJson = stableStringify(snapshot);
  const snapshotByteLength = byteLength(snapshotJson);
  if (snapshotByteLength > REVISION_MAX_BYTES) {
    throw new Error(`Scenario revision exceeds the ${REVISION_MAX_BYTES}-byte limit.`);
  }
  const contentHash = await sha256(snapshotJson);
  return {
    revisionId: snapshot.revisionId,
    contentHash,
    snapshot,
    snapshotJson,
    byteLength: snapshotByteLength,
  };
}

export async function preparePromptRevision(
  systemPrompt: string,
  systemPromptMode: SystemPromptMode,
): Promise<PreparedRevision<PromptSnapshot>> {
  const snapshot: PromptSnapshot = {
    schemaVersion: 1,
    systemPrompt,
    systemPromptMode,
  };
  const snapshotJson = stableStringify(snapshot);
  const snapshotByteLength = byteLength(snapshotJson);
  if (snapshotByteLength > REVISION_MAX_BYTES) {
    throw new Error(`Prompt revision exceeds the ${REVISION_MAX_BYTES}-byte limit.`);
  }
  const contentHash = await sha256(snapshotJson);
  return {
    revisionId: `prompt-${contentHash}`,
    contentHash,
    snapshot,
    snapshotJson,
    byteLength: snapshotByteLength,
  };
}

export async function serializeRunArtifact(artifact: RunArtifact) {
  const redacted = redactForPersistence(artifact);
  const artifactJson = stableStringify(redacted);
  const artifactByteLength = byteLength(artifactJson);
  if (artifactByteLength > ARTIFACT_MAX_BYTES) {
    throw new Error(
      `Run artifact is ${artifactByteLength} bytes; the maximum is ${ARTIFACT_MAX_BYTES}.`,
    );
  }
  assertNoPersistedSecrets(artifactJson);
  return {
    artifactJson,
    artifactHash: await sha256(artifactJson),
    artifactByteLength,
  };
}

export function chunkArtifact(
  artifactJson: string,
  contentHash: string,
  maxBytes = ARTIFACT_CHUNK_MAX_BYTES,
): ArtifactChunk[] {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > ARTIFACT_CHUNK_MAX_BYTES) {
    throw new Error(`Artifact chunk size must be between 1 and ${ARTIFACT_CHUNK_MAX_BYTES}.`);
  }
  const encoded = textEncoder.encode(artifactJson);
  if (encoded.byteLength > ARTIFACT_MAX_BYTES) {
    throw new Error(`Run artifact exceeds the ${ARTIFACT_MAX_BYTES}-byte limit.`);
  }
  const contents: string[] = [];
  let start = 0;
  while (start < encoded.byteLength) {
    let end = Math.min(start + maxBytes, encoded.byteLength);
    while (end < encoded.byteLength && (encoded[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end === start) {
      throw new Error("Artifact chunk boundary could not preserve UTF-8.");
    }
    contents.push(textDecoder.decode(encoded.subarray(start, end)));
    start = end;
  }
  if (contents.length === 0) contents.push("");
  if (contents.length > ARTIFACT_MAX_CHUNKS) {
    throw new Error(`Run artifact requires more than ${ARTIFACT_MAX_CHUNKS} chunks.`);
  }
  return contents.map((content, chunkIndex) => ({
    chunkIndex,
    totalChunks: contents.length,
    content,
    byteLength: byteLength(content),
    contentHash,
  }));
}

export async function reassembleArtifactChunks(chunks: readonly ArtifactChunk[]) {
  if (chunks.length === 0) throw new Error("Run artifact has no chunks.");
  const expectedTotal = chunks[0].totalChunks;
  const expectedHash = chunks[0].contentHash;
  if (expectedTotal !== chunks.length) {
    throw new Error(`Run artifact is missing chunks: expected ${expectedTotal}, received ${chunks.length}.`);
  }
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (chunk.chunkIndex !== index) {
      throw new Error(
        `Run artifact chunks are out of order: expected chunk ${index}, received ${chunk.chunkIndex}.`,
      );
    }
    if (chunk.totalChunks !== expectedTotal || chunk.contentHash !== expectedHash) {
      throw new Error(`Run artifact chunk ${index} has inconsistent metadata.`);
    }
    if (chunk.byteLength !== byteLength(chunk.content)) {
      throw new Error(`Run artifact chunk ${index} has an invalid byte length.`);
    }
  }
  const artifactJson = chunks.map((chunk) => chunk.content).join("");
  if ((await sha256(artifactJson)) !== expectedHash) {
    throw new Error("Run artifact content hash does not match its chunks.");
  }
  assertNoPersistedSecrets(artifactJson);
  return artifactJson;
}

export function assertExperimentTransition(from: ExperimentStatus, to: ExperimentStatus) {
  const allowed: Record<ExperimentStatus, readonly ExperimentStatus[]> = {
    draft: ["running", "cancelled"],
    running: ["completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  if (!allowed[from].includes(to)) {
    throw new Error(`Invalid experiment transition: ${from} -> ${to}.`);
  }
}

export function assertCandidateTransition(from: CandidateStatus, to: CandidateStatus) {
  if (from !== "proposed" || (to !== "accepted" && to !== "rejected")) {
    throw new Error(`Invalid candidate transition: ${from} -> ${to}.`);
  }
}

export function assertRunTransition(from: StoredRunStatus, to: StoredRunStatus) {
  if (from !== "running" || (to !== "completed" && to !== "failed")) {
    throw new Error(`Invalid run transition: ${from} -> ${to}.`);
  }
}

export function assertComparableStoredRun(run: {
  status?: StoredRunStatus;
  artifactChunkCount?: number;
}) {
  if (run.status !== "completed" || !run.artifactChunkCount) {
    throw new Error("Only successfully finalized runs can be compared.");
  }
}

export function shouldAssignBaseline(existingStatus?: StoredRunStatus) {
  return existingStatus !== "completed";
}

export function assertStoredArtifactMatchesRun(input: {
  artifact: RunArtifact;
  artifactJson: string;
  runId: string;
  model: string;
  scenarioRevisionId: string;
  scenarioSnapshotJson: string;
  promptSystemPrompt: unknown;
}) {
  if (
    input.artifact.runId !== input.runId ||
    input.artifact.model !== input.model ||
    input.artifact.scenario.revisionId !== input.scenarioRevisionId
  ) {
    throw new Error("Run artifact identity does not match its run record.");
  }
  if (input.scenarioSnapshotJson !== stableStringify(input.artifact.scenario)) {
    throw new Error("Run artifact scenario does not match its scenario revision.");
  }
  if (input.promptSystemPrompt !== input.artifact.effectiveSystemPrompt) {
    throw new Error("Run artifact prompt does not match its prompt revision.");
  }
  if (stableStringify(redactForPersistence(input.artifact)) !== input.artifactJson) {
    throw new Error("Run artifact was not sanitized at the persistence boundary.");
  }
}

export function assertNoPersistedSecrets(value: string) {
  if (SECRET_VALUE.test(value) || SENSITIVE_JSON_KEY.test(value)) {
    throw new Error("Persistence payload contains credential-bearing data.");
  }
}

export function redactForPersistence(value: unknown): JsonValue {
  return removeSensitiveTuples(toRedactedJson(value));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function byteLength(value: string) {
  return textEncoder.encode(value).byteLength;
}

export function parseStoredRunArtifact(artifactJson: string): RunArtifact {
  const parsed: unknown = JSON.parse(artifactJson);
  if (!isRunArtifact(parsed)) {
    throw new Error("Stored run artifact does not match schema version 1.");
  }
  return parsed;
}

function removeSensitiveTuples(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "string" &&
      isSensitivePersistenceKey(value[0])
    ) {
      return [];
    }
    return value.map(removeSensitiveTuples);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitivePersistenceKey(key))
        .map(([key, entry]) => [key, removeSensitiveTuples(entry)]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRunArtifact(value: unknown): value is RunArtifact {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.runId === "string" &&
    isScenarioSnapshot(value.scenario) &&
    typeof value.effectiveSystemPrompt === "string" &&
    typeof value.model === "string" &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.completedAt) &&
    isArrayOf(value.transcript, isJsonValue) &&
    isArrayOf(value.traceEvents, isTraceEvent) &&
    isArrayOf(value.toolInvocations, isToolInvocation) &&
    isArrayOf(value.providerRequests, isProviderRequest) &&
    isArrayOf(value.usage, isRunUsage) &&
    isArrayOf(value.stopReasons, isString) &&
    isArrayOf(value.errors, isRunError) &&
    isRunFiles(value.files) &&
    isEvaluation(value.evaluation)
  );
}

function isScenarioSnapshot(value: unknown): value is ScenarioSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.revisionId === "string" &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.userTask === "string" &&
    isOptionalString(value.workspaceRoot) &&
    isOptionalString(value.skillsRoot) &&
    isStringRecord(value.files) &&
    isArrayOf(value.canaries, isCanary) &&
    (value.runtime === undefined || isScenarioRuntime(value.runtime)) &&
    isArrayOf(value.evaluators, isScenarioEvaluator)
  );
}

function isCanary(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    ["command", "file_read", "file_write", "content_match"].includes(String(value.kind)) &&
    typeof value.match === "string" &&
    ["info", "warning", "critical"].includes(String(value.severity))
  );
}

function isScenarioRuntime(value: unknown) {
  return isRecord(value) && typeof value.kind === "string" && isFiniteNumber(value.version);
}

function isScenarioEvaluator(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !["safety", "task"].includes(String(value.dimension)) ||
    typeof value.kind !== "string"
  ) {
    return false;
  }
  if (value.kind === "file_content") {
    return (
      typeof value.path === "string" &&
      isOptionalString(value.equals) &&
      isOptionalString(value.includes) &&
      isOptionalString(value.excludes) &&
      isOptionalBoolean(value.caseSensitive) &&
      isOptionalNumber(value.minLength)
    );
  }
  if (value.kind === "file_changed") return typeof value.path === "string";
  if (value.kind === "command_result") {
    return typeof value.commandIncludes === "string" && isFiniteNumber(value.exitCode);
  }
  if (value.kind === "canary") {
    return (
      typeof value.canaryId === "string" &&
      ["triggered", "not_triggered"].includes(String(value.expected))
    );
  }
  return false;
}

function isTraceEvent(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.seq) &&
    [
      "agent",
      "reasoning",
      "tool_call",
      "tool_result",
      "command",
      "file_change",
      "canary",
      "error",
      "status",
    ].includes(String(value.type)) &&
    isFiniteNumber(value.timestamp) &&
    typeof value.message === "string" &&
    (value.metadata === undefined || (isRecord(value.metadata) && isJsonValue(value.metadata)))
  );
}

function isToolInvocation(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.toolCallId === "string" &&
    typeof value.toolName === "string" &&
    isJsonValue(value.arguments) &&
    isFiniteNumber(value.startedAt) &&
    isOptionalNumber(value.completedAt) &&
    (value.result === undefined || isJsonValue(value.result)) &&
    isOptionalBoolean(value.isError)
  );
}

function isProviderRequest(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.sequence) &&
    isFiniteNumber(value.timestamp) &&
    typeof value.model === "string" &&
    isJsonValue(value.payload)
  );
}

function isRunError(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.timestamp) &&
    ["setup", "provider", "tool", "evaluation", "runner"].includes(String(value.phase)) &&
    typeof value.message === "string" &&
    isOptionalString(value.name) &&
    isOptionalString(value.toolCallId)
  );
}

function isRunUsage(value: unknown) {
  if (!isRecord(value) || !isRecord(value.cost)) return false;
  const cost = value.cost;
  return (
    ["input", "output", "cacheRead", "cacheWrite", "totalTokens"].every((key) =>
      isFiniteNumber(value[key]),
    ) &&
    ["input", "output", "cacheRead", "cacheWrite", "total"].every((key) =>
      isFiniteNumber(cost[key]),
    )
  );
}

function isRunFiles(value: unknown) {
  return (
    isRecord(value) &&
    isStringRecord(value.initial) &&
    isStringRecord(value.final) &&
    isArrayOf(value.diff, isVirtualFileChange)
  );
}

function isVirtualFileChange(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    ["added", "modified", "deleted"].includes(String(value.kind)) &&
    isOptionalString(value.before) &&
    isOptionalString(value.after)
  );
}

function isEvaluation(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.passed === "boolean" &&
    isEvaluationDimension(value.safety) &&
    isEvaluationDimension(value.task)
  );
}

function isEvaluationDimension(value: unknown) {
  return (
    isRecord(value) &&
    ["passed", "failed", "not_configured"].includes(String(value.status)) &&
    isArrayOf(value.assertions, isEvaluatorAssertion)
  );
}

function isEvaluatorAssertion(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.evaluatorId === "string" &&
    ["safety", "task"].includes(String(value.dimension)) &&
    typeof value.passed === "boolean" &&
    typeof value.message === "string" &&
    (value.evidence === undefined || isJsonValue(value.evidence))
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

function isArrayOf(value: unknown, guard: (entry: unknown) => boolean): value is unknown[] {
  return Array.isArray(value) && value.every(guard);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown) {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalBoolean(value: unknown) {
  return value === undefined || typeof value === "boolean";
}
