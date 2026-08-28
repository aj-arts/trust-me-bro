import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import type { ScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import type { RunArtifact, ScenarioRunResult } from "../browser-runner/types.ts";
import type { SystemPromptMode } from "../../scenarios/system-prompts.ts";
import type { ProposalValidationIssue } from "../meta-agent/types.ts";
import {
  chunkArtifact,
  assertNoPersistedSecrets,
  preparePromptRevision,
  prepareScenarioRevision,
  serializeRunArtifact,
  type CandidateStatus,
  type ExperimentStatus,
  type PreparedRevision,
  type PromptSnapshot,
  type RunSource,
} from "./core.ts";

export type ExperimentRecord = {
  experimentId: string;
  name: string;
  objective: string;
  scenarioRevisionId: string;
  promptRevisionId: string;
  configurationJson?: string;
  proposalReservation?: {
    attemptId: string;
    candidateId: string;
    modelId: string;
    maxTokens: number;
    estimatedCostUsd: number;
    reservedAt: number;
  };
  status: ExperimentStatus;
  baselineRunId?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  failureMessage?: string;
};

export type CandidateRecord = {
  candidateId: string;
  experimentId: string;
  parentCandidateId?: string;
  scenarioRevisionId: string;
  promptRevisionId: string;
  mutationKind: "scenario" | "prompt";
  status: CandidateStatus;
  rationale?: string;
  generatedBy?: string;
  proposalJson?: string;
  proposalTokens?: number;
  proposalCostUsd?: number;
  validationIssuesJson?: string;
  createdAt: number;
  decidedAt?: number;
};

export type StoredRunSummary = {
  runId?: string;
  experimentId?: string;
  candidateId?: string;
  scenarioId: string;
  scenarioTitle: string;
  model: string;
  systemPromptMode: SystemPromptMode;
  startedAt?: number;
  completedAt?: number;
  status?: "running" | "completed" | "failed";
  passed: boolean;
  artifactChunkCount?: number;
};

export type ExperimentDetail = {
  experiment: ExperimentRecord;
  candidates: CandidateRecord[];
  runs: StoredRunSummary[];
  candidatesTruncated: boolean;
  runsTruncated: boolean;
};

export type RunDetail = {
  run: StoredRunSummary;
  scenarioRevision: {
    revisionId: string;
    contentHash: string;
    parentRevisionId?: string;
    snapshotJson: string;
  };
  promptRevision: {
    revisionId: string;
    contentHash: string;
    parentRevisionId?: string;
    snapshotJson: string;
  };
  artifact: RunArtifact;
};

export type RunComparison = {
  baseline: {
    runId: string;
    passed: boolean;
    safetyStatus: string;
    taskStatus: string;
    totalTokens: number;
    cost: number;
    fileChanges: number;
    errors: number;
  };

  candidate: RunComparison["baseline"];
  delta: {
    passed: number;
    totalTokens: number;
    cost: number;
    fileChanges: number;
  };

};

export class OptimizerLeaseConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizerLeaseConflictError";
  }
}

export type BeginRunInput = {
  runId: string;
  source: RunSource;
  experimentId?: string;
  candidateId?: string;
  scenario: ScenarioSnapshot;
  scenarioParentRevisionId?: string;
  effectiveSystemPrompt: string;
  systemPromptMode: SystemPromptMode;
  promptParentRevisionId?: string;
  model: string;
  startedAt: number;
};

export interface ExperimentRepository {
  createScenarioRevision(
    snapshot: ScenarioSnapshot,
    parentRevisionId?: string,
  ): Promise<PreparedRevision<ScenarioSnapshot>>;
  createPromptRevision(
    systemPrompt: string,
    systemPromptMode: SystemPromptMode,
    parentRevisionId?: string,
  ): Promise<PreparedRevision<PromptSnapshot>>;
  createExperiment(input: {
    experimentId: string;
    name: string;
    objective: string;
    scenarioRevisionId: string;
    promptRevisionId: string;
  }): Promise<void>;
  startExperiment(experimentId: string): Promise<void>;
  bindOptimizerConfiguration(experimentId: string, configurationJson: string): Promise<void>;
  reserveProposalAttempt(input: {
    experimentId: string;
    attemptId: string;
    candidateId: string;
    modelId: string;
    maxTokens: number;
    estimatedCostUsd: number;
  }): Promise<void>;
  completeProposalAttempt(experimentId: string, attemptId: string): Promise<void>;
  completeExperiment(experimentId: string): Promise<void>;
  failExperiment(experimentId: string, failureMessage: string): Promise<void>;
  cancelExperiment(experimentId: string): Promise<void>;
  createCandidate(input: {
    candidateId: string;
    experimentId: string;
    parentCandidateId?: string;
    scenarioRevisionId: string;
    promptRevisionId: string;
    mutationKind: "scenario" | "prompt";
    rationale?: string;
    generatedBy?: string;
    proposalJson?: string;
    proposalTokens?: number;
    proposalCostUsd?: number;
  }): Promise<void>;
  createRejectedCandidate(input: {
    candidateId: string;
    experimentId: string;
    parentCandidateId?: string;
    scenarioRevisionId: string;
    promptRevisionId: string;
    mutationKind: "scenario" | "prompt";
    rationale?: string;
    generatedBy?: string;
    proposalJson: string;
    proposalTokens: number;
    proposalCostUsd: number;
    validationIssues: ProposalValidationIssue[];
  }): Promise<void>;
  decideCandidate(candidateId: string, decision: "accepted" | "rejected"): Promise<void>;
  listExperimentHistory(limit?: number): Promise<ExperimentRecord[]>;
  loadExperiment(experimentId: string): Promise<ExperimentDetail>;
  loadCandidateAncestry(candidateId: string): Promise<CandidateRecord[]>;
  loadRunDetail(runId: string): Promise<RunDetail>;
  compareRuns(baselineRunId: string, candidateRunId: string): Promise<RunComparison>;
  beginRun(input: BeginRunInput): Promise<"started" | "completed">;
  abortRun(runId: string, reason: "execution_failed" | "cancelled"): Promise<void>;
  finishRun(result: ScenarioRunResult): Promise<void>;
  persistBenchmarkRun(result: ScenarioRunResult, systemPromptMode: SystemPromptMode): Promise<void>;
}

export class ConvexExperimentRepository implements ExperimentRepository {
  private readonly client: ConvexReactClient;

  constructor(client: ConvexReactClient) {
    this.client = client;
  }

  async createScenarioRevision(snapshot: ScenarioSnapshot, parentRevisionId?: string) {
    const revision = await prepareScenarioRevision(snapshot);
    await this.client.mutation(api.revisions.createScenario, {
      revisionId: revision.revisionId,
      contentHash: revision.contentHash,
      parentRevisionId,
      snapshotJson: revision.snapshotJson,
    });
    return revision;
  }

  async createPromptRevision(
    systemPrompt: string,
    systemPromptMode: SystemPromptMode,
    parentRevisionId?: string,
  ) {
    const revision = await preparePromptRevision(systemPrompt, systemPromptMode);
    await this.client.mutation(api.revisions.createPrompt, {
      revisionId: revision.revisionId,
      contentHash: revision.contentHash,
      parentRevisionId,
      systemPromptMode,
      snapshotJson: revision.snapshotJson,
    });
    return revision;
  }

  async createExperiment(input: Parameters<ExperimentRepository["createExperiment"]>[0]) {
    assertNoPersistedSecrets(input.name);
    assertNoPersistedSecrets(input.objective);
    await this.client.mutation(api.experiments.create, input);
  }

  async startExperiment(experimentId: string) {
    await this.client.mutation(api.experiments.start, { experimentId });
  }

  async bindOptimizerConfiguration(experimentId: string, configurationJson: string) {
    assertNoPersistedSecrets(configurationJson);
    await this.client.mutation(api.experiments.bindConfiguration, {
      experimentId,
      configurationJson,
    });
  }

  async reserveProposalAttempt(
    input: Parameters<ExperimentRepository["reserveProposalAttempt"]>[0],
  ) {
    try {
      await this.client.mutation(api.experiments.reserveProposal, input);
    } catch (error) {
      if (isLeaseConflict(error, "PROPOSAL_LEASE_CONFLICT")) {
        throw new OptimizerLeaseConflictError("Another optimizer is generating this proposal.");
      }
      throw error;
    }
  }

  async completeProposalAttempt(experimentId: string, attemptId: string) {
    await this.client.mutation(api.experiments.completeProposal, {
      experimentId,
      attemptId,
    });
  }

  async completeExperiment(experimentId: string) {
    await this.client.mutation(api.experiments.complete, { experimentId });
  }

  async failExperiment(experimentId: string, failureMessage: string) {
    assertNoPersistedSecrets(failureMessage);
    await this.client.mutation(api.experiments.fail, { experimentId, failureMessage });
  }

  async cancelExperiment(experimentId: string) {
    await this.client.mutation(api.experiments.cancel, { experimentId });
  }

  async createCandidate(input: Parameters<ExperimentRepository["createCandidate"]>[0]) {
    for (const value of [input.rationale, input.generatedBy, input.proposalJson]) {
      if (value) assertNoPersistedSecrets(value);
    }

    await this.client.mutation(api.experiments.createCandidate, input);
  }

  async createRejectedCandidate(
    input: Parameters<ExperimentRepository["createRejectedCandidate"]>[0],
  ) {
    const validationIssuesJson = JSON.stringify(input.validationIssues);
    for (const value of [
      input.rationale,
      input.generatedBy,
      input.proposalJson,
      validationIssuesJson,
    ]) {
      if (value) assertNoPersistedSecrets(value);
    }
    const { validationIssues: _validationIssues, ...candidate } = input;
    void _validationIssues;
    await this.client.mutation(api.experiments.createRejectedCandidate, {
      ...candidate,
      validationIssuesJson,
    });
  }

  async decideCandidate(candidateId: string, decision: "accepted" | "rejected") {
    await this.client.mutation(api.experiments.decideCandidate, { candidateId, decision });
  }

  async listExperimentHistory(limit?: number): Promise<ExperimentRecord[]> {
    return await this.client.query(api.experiments.listHistory, { limit });
  }

  async loadExperiment(experimentId: string): Promise<ExperimentDetail> {
    return await this.client.query(api.experiments.getDetail, { experimentId });
  }

  async loadCandidateAncestry(candidateId: string): Promise<CandidateRecord[]> {
    return await this.client.query(api.experiments.getCandidateAncestry, { candidateId });
  }

  async loadRunDetail(runId: string): Promise<RunDetail> {
    return await this.client.query(api.runs.loadFullDetail, { runId });
  }

  async compareRuns(baselineRunId: string, candidateRunId: string): Promise<RunComparison> {
    return await this.client.query(api.runs.compare, { baselineRunId, candidateRunId });
  }

  async beginRun(input: BeginRunInput) {
    const attemptId = createStableClientId("attempt");
    const [scenarioRevision, promptRevision] = await Promise.all([
      this.createScenarioRevision(input.scenario, input.scenarioParentRevisionId),
      this.createPromptRevision(
        input.effectiveSystemPrompt,
        input.systemPromptMode,
        input.promptParentRevisionId,
      ),
    ]);
    try {
      const result = await this.client.mutation(api.runs.start, {
        runId: input.runId,
        source: input.source,
        experimentId: input.experimentId,
        candidateId: input.candidateId,
        scenarioRevisionId: scenarioRevision.revisionId,
        promptRevisionId: promptRevision.revisionId,
        scenarioId: input.scenario.id,
        scenarioTitle: input.scenario.title,
        model: input.model,
        systemPromptMode: input.systemPromptMode,
        startedAt: input.startedAt,
        attemptId,
      });
      return result.state;
    } catch (error) {
      if (isLeaseConflict(error, "RUN_LEASE_CONFLICT")) {
        throw new OptimizerLeaseConflictError(`Run ${input.runId} is already owned.`);
      }
      throw error;
    }
  }

  async finishRun(result: ScenarioRunResult) {
    let chunks;
    try {
      const serialized = await serializeRunArtifact(result.artifact);
      chunks = chunkArtifact(serialized.artifactJson, serialized.artifactHash);
    } catch (error) {
      await this.client.mutation(api.runs.abort, {
        runId: result.artifact.runId,
        reason:
          error instanceof Error && /exceed|maximum|more than/i.test(error.message)
            ? "artifact_too_large"
            : "artifact_serialization_failed",
      });
      throw error;
    }

    for (const chunk of chunks) {
      await this.client.mutation(api.runs.appendArtifactChunk, {
        runId: result.artifact.runId,
        ...chunk,
      });
    }
    if (result.status === "completed") {
      await this.client.mutation(api.runs.complete, { runId: result.artifact.runId });
    } else {
      await this.client.mutation(api.runs.fail, { runId: result.artifact.runId });
    }
  }

  async abortRun(runId: string, reason: "execution_failed" | "cancelled") {
    await this.client.mutation(api.runs.abort, { runId, reason });
  }

  async persistBenchmarkRun(result: ScenarioRunResult, systemPromptMode: SystemPromptMode) {
    const state = await this.beginRun({
      runId: result.artifact.runId,
      source: "benchmark",
      scenario: result.artifact.scenario,
      effectiveSystemPrompt: result.artifact.effectiveSystemPrompt,
      systemPromptMode,
      model: result.artifact.model,
      startedAt: result.artifact.startedAt,
    });
    if (state === "completed") return;
    await this.finishRun(result);
  }
}

export function createExperimentId() {
  return createStableClientId("experiment");
}

export function createCandidateId() {
  return createStableClientId("candidate");
}

export function createStoredRunId() {
  return createStableClientId("run");
}

function createStableClientId(prefix: string) {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Secure browser identifiers are unavailable.");
  }

  return `${prefix}-${crypto.randomUUID()}`;
}

function isLeaseConflict(error: unknown, code: string) {
  return error instanceof Error && error.message.includes(code);
}
