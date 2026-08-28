import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  scenarioRevisions: defineTable({
    schemaVersion: v.literal(1),
    revisionId: v.string(),
    contentHash: v.string(),
    scenarioId: v.string(),
    parentRevisionId: v.optional(v.string()),
    snapshotJson: v.string(),
    byteLength: v.number(),
    createdAt: v.number(),
  })
    .index("by_revision_id", ["revisionId"])
    .index("by_content_hash", ["contentHash"])
    .index("by_scenario_created_at", ["scenarioId", "createdAt"])
    .index("by_parent_revision", ["parentRevisionId"]),
  promptRevisions: defineTable({
    schemaVersion: v.literal(1),
    revisionId: v.string(),
    contentHash: v.string(),
    parentRevisionId: v.optional(v.string()),
    systemPromptMode: v.union(
      v.literal("safe"),
      v.literal("neutral"),
      v.literal("permissive"),
    ),
    snapshotJson: v.string(),
    byteLength: v.number(),
    createdAt: v.number(),
  })
    .index("by_revision_id", ["revisionId"])
    .index("by_content_hash", ["contentHash"])
    .index("by_parent_revision", ["parentRevisionId"]),
  experiments: defineTable({
    schemaVersion: v.literal(1),
    experimentId: v.string(),
    name: v.string(),
    objective: v.string(),
    scenarioRevisionId: v.string(),
    promptRevisionId: v.string(),
    configurationJson: v.optional(v.string()),
    proposalReservation: v.optional(
      v.object({
        attemptId: v.string(),
        candidateId: v.string(),
        modelId: v.string(),
        maxTokens: v.number(),
        estimatedCostUsd: v.number(),
        reservedAt: v.number(),
      }),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    baselineRunId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failureMessage: v.optional(v.string()),
  })
    .index("by_experiment_id", ["experimentId"])
    .index("by_updated_at", ["updatedAt"])
    .index("by_status_updated_at", ["status", "updatedAt"]),
  candidates: defineTable({
    schemaVersion: v.literal(1),
    candidateId: v.string(),
    experimentId: v.string(),
    parentCandidateId: v.optional(v.string()),
    scenarioRevisionId: v.string(),
    promptRevisionId: v.string(),
    mutationKind: v.union(v.literal("scenario"), v.literal("prompt")),
    status: v.union(
      v.literal("proposed"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    rationale: v.optional(v.string()),
    generatedBy: v.optional(v.string()),
    proposalJson: v.optional(v.string()),
    proposalTokens: v.optional(v.number()),
    proposalCostUsd: v.optional(v.number()),
    validationIssuesJson: v.optional(v.string()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_experiment_created_at", ["experimentId", "createdAt"])
    .index("by_parent_candidate", ["parentCandidateId"]),
  runs: defineTable({
    scenarioId: v.string(),
    scenarioTitle: v.string(),
    model: v.string(),
    systemPromptMode: v.union(
      v.literal("safe"),
      v.literal("neutral"),
      v.literal("permissive"),
    ),
    savedAt: v.number(),
    completedAt: v.optional(v.number()),
    passed: v.boolean(),
    canaryTriggered: v.boolean(),
    canaryHits: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        severity: v.union(
          v.literal("info"),
          v.literal("warning"),
          v.literal("critical"),
        ),
      }),
    ),
    traceEventCount: v.number(),
    schemaVersion: v.optional(v.literal(2)),
    runId: v.optional(v.string()),
    source: v.optional(v.union(v.literal("benchmark"), v.literal("experiment"))),
    status: v.optional(
      v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    ),
    attemptId: v.optional(v.string()),
    experimentId: v.optional(v.string()),
    candidateId: v.optional(v.string()),
    scenarioRevisionId: v.optional(v.string()),
    promptRevisionId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    failureMessage: v.optional(v.string()),
    failureCode: v.optional(
      v.union(
        v.literal("artifact_too_large"),
        v.literal("artifact_serialization_failed"),
        v.literal("execution_failed"),
        v.literal("cancelled"),
      ),
    ),
    artifactHash: v.optional(v.string()),
    artifactByteLength: v.optional(v.number()),
    artifactChunkCount: v.optional(v.number()),
  })
    .index("by_saved_at", ["savedAt"])
    .index("by_scenario", ["scenarioId"])
    .index("by_model", ["model"])
    .index("by_mode", ["systemPromptMode"])
    .index("by_run_id", ["runId"])
    .index("by_experiment_started_at", ["experimentId", "startedAt"])
    .index("by_candidate_started_at", ["candidateId", "startedAt"]),
  runEvents: defineTable({
    schemaVersion: v.literal(1),
    runId: v.string(),
    stream: v.literal("artifact"),
    chunkIndex: v.number(),
    totalChunks: v.number(),
    content: v.string(),
    byteLength: v.number(),
    contentHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_run_stream_index", ["runId", "stream", "chunkIndex"])
    .index("by_run", ["runId"]),
});
