import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  assertRunTransition,
  assertComparableStoredRun,
  assertStoredArtifactMatchesRun,
  shouldAssignBaseline,
  assertNoPersistedSecrets,
  byteLength,
  parseStoredRunArtifact,
  redactForPersistence,
} from "../src/lib/experiment-store/core";
import type { RunArtifact } from "../src/lib/browser-runner/types";
import { stableStringify } from "../src/lib/browser-runner/scenarioSnapshot";
import {
  runArtifactFailed,
  runArtifactFailureReason,
} from "../src/lib/browser-runner/runStatus";
import {
  loadArtifactJson,
  requireCandidate,
  requireExperiment,
  requirePromptRevision,
  requireRun,
  requireScenarioRevision,
  validateArtifactChunk,
} from "./storageHelpers";

const systemPromptMode = v.union(
  v.literal("safe"),
  v.literal("neutral"),
  v.literal("permissive"),
);

const canaryHit = v.object({
  id: v.string(),
  label: v.string(),
  severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
});

export const listForDashboard = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_saved_at")
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), undefined),
          q.and(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("source"), "benchmark"),
          ),
        ),
      )
      .take(2000);
  },
});

export const save = mutation({
  args: {
    scenarioId: v.string(),
    scenarioTitle: v.string(),
    model: v.string(),
    systemPromptMode,
    completedAt: v.number(),
    passed: v.boolean(),
    canaryTriggered: v.boolean(),
    canaryHits: v.array(canaryHit),
    traceEventCount: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      ...args,
      savedAt: Date.now(),
    });
  },
});

export const start = mutation({
      args: {
        runId: v.string(),
        source: v.union(v.literal("benchmark"), v.literal("experiment")),
        experimentId: v.optional(v.string()),
        candidateId: v.optional(v.string()),
        scenarioRevisionId: v.string(),
        promptRevisionId: v.string(),
        scenarioId: v.string(),
        scenarioTitle: v.string(),
        model: v.string(),
        systemPromptMode,
        startedAt: v.number(),
        attemptId: v.string(),
      },
      handler: async (ctx, args) => {
        if (!args.runId.trim() || !args.model.trim()) throw new ConvexError("Run ID and model are required.");
        const existing = await ctx.db
          .query("runs")
          .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
          .unique();
        if (existing) {
          const metadataMatches =
            existing.source === args.source &&
            existing.experimentId === args.experimentId &&
            existing.candidateId === args.candidateId &&
            existing.scenarioRevisionId === args.scenarioRevisionId &&
            existing.promptRevisionId === args.promptRevisionId &&
            existing.model === args.model &&
            existing.systemPromptMode === args.systemPromptMode;
          if (
            existing.status === "running" &&
            existing.attemptId === args.attemptId &&
            metadataMatches
          ) {
            return { state: "started" as const, id: existing._id };
          }
          if (existing.status === "completed" && metadataMatches) {
            return { state: "completed" as const, id: existing._id };
          }
          if (existing.status === "running") {
            throw new ConvexError(`RUN_LEASE_CONFLICT: Run ${args.runId} is already owned.`);
          }
          throw new ConvexError(`Run ${args.runId} already exists with different state or metadata.`);
        }
        const [scenarioRevision, promptRevision] = await Promise.all([
          requireScenarioRevision(ctx.db, args.scenarioRevisionId),
          requirePromptRevision(ctx.db, args.promptRevisionId),
        ]);
        if (
          scenarioRevision.scenarioId !== args.scenarioId ||
          promptRevision.systemPromptMode !== args.systemPromptMode
        ) {
          throw new ConvexError("Run metadata does not match its revisions.");
        }
        const scenarioSnapshot = JSON.parse(scenarioRevision.snapshotJson) as {
          title?: unknown;
        };
        if (scenarioSnapshot.title !== args.scenarioTitle) {
          throw new ConvexError("Run title does not match its scenario revision.");
        }
        if (args.source === "experiment") {
          if (!args.experimentId) throw new ConvexError("Experiment runs require an experiment ID.");
          const experiment = await requireExperiment(ctx.db, args.experimentId);
          if (experiment.status !== "running") {
            throw new ConvexError("Experiment runs require a running experiment.");
          }
          if (args.candidateId) {
            const candidate = await requireCandidate(ctx.db, args.candidateId);
            if (
              candidate.experimentId !== args.experimentId ||
              candidate.scenarioRevisionId !== args.scenarioRevisionId ||
              candidate.promptRevisionId !== args.promptRevisionId
            ) {
              throw new ConvexError("Run revisions do not match the experiment candidate.");
            }
          } else if (
            experiment.scenarioRevisionId !== args.scenarioRevisionId ||
            experiment.promptRevisionId !== args.promptRevisionId
          ) {
            throw new ConvexError("Baseline run revisions do not match the experiment.");
          }
        } else if (args.experimentId || args.candidateId) {
          throw new ConvexError("Benchmark runs cannot reference experiments or candidates.");
        }
        const id = await ctx.db.insert("runs", {
          schemaVersion: 2,
          runId: args.runId,
          source: args.source,
          status: "running",
          attemptId: args.attemptId,
          experimentId: args.experimentId,
          candidateId: args.candidateId,
          scenarioRevisionId: args.scenarioRevisionId,
          promptRevisionId: args.promptRevisionId,
          scenarioId: args.scenarioId,
          scenarioTitle: args.scenarioTitle,
          model: args.model,
          systemPromptMode: args.systemPromptMode,
          startedAt: args.startedAt,
          savedAt: Date.now(),
          passed: false,
          canaryTriggered: false,
          canaryHits: [],
          traceEventCount: 0,
        });
        return { state: "started" as const, id };
      },
    });

    export const appendArtifactChunk = mutation({
      args: {
        runId: v.string(),
        chunkIndex: v.number(),
        totalChunks: v.number(),
        content: v.string(),
        byteLength: v.number(),
        contentHash: v.string(),
      },
      handler: async (ctx, args) => {
        validateArtifactChunk(args);
        const run = await requireRun(ctx.db, args.runId);
        if (run.status !== "running") {
          throw new ConvexError("Artifact chunks can only be appended to a running run.");
        }
        const existing = await ctx.db
          .query("runEvents")
          .withIndex("by_run_stream_index", (q) =>
            q.eq("runId", args.runId).eq("stream", "artifact").eq("chunkIndex", args.chunkIndex),
          )
          .unique();
        if (existing) {
          if (
            existing.content === args.content &&
            existing.contentHash === args.contentHash &&
            existing.totalChunks === args.totalChunks
          ) {
            return existing._id;
          }
          throw new ConvexError(`Artifact chunk ${args.chunkIndex} already has different content.`);
        }
        const previous =
          args.chunkIndex === 0
            ? null
            : await ctx.db
                .query("runEvents")
                .withIndex("by_run_stream_index", (q) =>
                  q
                    .eq("runId", args.runId)
                    .eq("stream", "artifact")
                    .eq("chunkIndex", args.chunkIndex - 1),
                )
                .unique();
        if (args.chunkIndex > 0 && !previous) {
          throw new ConvexError(
            `Artifact chunks must be appended in order; chunk ${args.chunkIndex - 1} is missing.`,
          );
        }
        if (
          previous &&
          (previous.totalChunks !== args.totalChunks || previous.contentHash !== args.contentHash)
        ) {
          throw new ConvexError("Artifact chunk metadata changed during upload.");
        }
        const carry = previous?.content.slice(-256) ?? "";
        try {
          assertNoPersistedSecrets(carry + args.content);
        } catch (error) {
          throw new ConvexError(error instanceof Error ? error.message : "Artifact contains a secret.");
        }
        const chunkId = await ctx.db.insert("runEvents", {
          schemaVersion: 1,
          runId: args.runId,
          stream: "artifact",
          chunkIndex: args.chunkIndex,
          totalChunks: args.totalChunks,
          content: args.content,
          byteLength: args.byteLength,
          contentHash: args.contentHash,
          createdAt: Date.now(),
        });
        if (args.chunkIndex === 0) {
          await ctx.db.patch(run._id, {
            artifactHash: args.contentHash,
            artifactChunkCount: args.totalChunks,
          });
        }
        return chunkId;
      },
    });

    export const complete = mutation({
      args: { runId: v.string() },
      handler: async (ctx, args) => await finalizeRun(ctx, args.runId, "completed"),
    });

    export const fail = mutation({
      args: { runId: v.string() },
      handler: async (ctx, args) => await finalizeRun(ctx, args.runId, "failed"),
    });

    export const abort = mutation({
      args: {
        runId: v.string(),
        reason: v.union(
          v.literal("artifact_too_large"),
          v.literal("artifact_serialization_failed"),
          v.literal("execution_failed"),
          v.literal("cancelled"),
        ),
      },
      handler: async (ctx, args) => {
        const run = await requireRun(ctx.db, args.runId);
        if (run.status === "failed") return run._id;
        try {
          assertRunTransition(run.status ?? "completed", "failed");
        } catch (error) {
          throw new ConvexError(error instanceof Error ? error.message : "Invalid run transition.");
        }
        const failedAt = Date.now();
        await ctx.db.patch(run._id, {
          status: "failed",
          failedAt,
          completedAt: failedAt,
          failureCode: args.reason,
          failureMessage:
            args.reason === "artifact_too_large"
              ? "Run artifact exceeded the persistence size limit."
              : args.reason === "artifact_serialization_failed"
                ? "Run artifact could not be serialized for persistence."
                : args.reason === "cancelled"
                  ? "Run execution was cancelled."
                  : "Run execution failed before an artifact could be finalized.",
        });
        return run._id;
      },
    });

    export const loadFullDetail = query({
      args: { runId: v.string() },
      handler: async (ctx, args) => {
        const run = await requireRun(ctx.db, args.runId);
        if (!run.scenarioRevisionId || !run.promptRevisionId) {
          throw new ConvexError("Legacy aggregate runs do not contain a full artifact.");
        }
        if (run.status === "running" || !run.artifactChunkCount) {
          throw new ConvexError("Run artifact is not available until persistence completes.");
        }
        const [scenarioRevision, promptRevision] = await Promise.all([
          requireScenarioRevision(ctx.db, run.scenarioRevisionId),
          requirePromptRevision(ctx.db, run.promptRevisionId),
        ]);
        return {
          run,
          scenarioRevision,
          promptRevision,
          artifact: await loadValidatedArtifact(ctx, run),
        };
      },
    });

    export const compare = query({
      args: { baselineRunId: v.string(), candidateRunId: v.string() },
      handler: async (ctx, args) => {
        const baseline = await loadComparableRun(ctx, args.baselineRunId);
        const candidate = await loadComparableRun(ctx, args.candidateRunId);
        if (
          !baseline.run.experimentId ||
          baseline.run.experimentId !== candidate.run.experimentId ||
          baseline.run.candidateId ||
          !candidate.run.candidateId
        ) {
          throw new ConvexError("Comparison requires a baseline and candidate from the same experiment.");
        }
        return {
          baseline: summarizeArtifact(baseline.artifact),
          candidate: summarizeArtifact(candidate.artifact),
          delta: {
            passed: Number(candidate.artifact.evaluation.passed) - Number(baseline.artifact.evaluation.passed),
            totalTokens: totalTokens(candidate.artifact) - totalTokens(baseline.artifact),
            cost: totalCost(candidate.artifact) - totalCost(baseline.artifact),
            fileChanges:
              candidate.artifact.files.diff.length - baseline.artifact.files.diff.length,
          },
        };
      },
    });

    async function finalizeRun(
      ctx: MutationCtx,
      runId: string,
      status: "completed" | "failed",
      failureMessage?: string,
    ) {
      const run = await requireRun(ctx.db, runId);
      try {
        assertRunTransition(run.status ?? "completed", status);
      } catch (error) {
        throw new ConvexError(error instanceof Error ? error.message : "Invalid run transition.");
      }
      const artifact = await loadValidatedArtifact(ctx, run);
      const artifactFailed = runArtifactFailed(artifact);
      if ((status === "failed") !== artifactFailed) {
        throw new ConvexError("Run terminal state does not match its structured artifact.");
      }
      const persistedFailureMessage =
        status === "failed"
          ? runArtifactFailureReason(artifact)
          : failureMessage;
      const canaryHits = canaryHitsForArtifact(artifact);
      await ctx.db.patch(run._id, {
        status,
        startedAt: artifact.startedAt,
        completedAt: artifact.completedAt,
        failedAt: status === "failed" ? artifact.completedAt : undefined,
        failureMessage: persistedFailureMessage,
        passed: status === "completed" && artifact.evaluation.passed,
        canaryTriggered: canaryHits.length > 0,
        canaryHits,
        traceEventCount: artifact.traceEvents.length,
        artifactByteLength: byteLength(stableStringify(redactForPersistence(artifact))),
      });
      if (run.experimentId && !run.candidateId && status === "completed") {
        const experiment = await requireExperiment(ctx.db, run.experimentId);
        const existingBaseline = experiment.baselineRunId
          ? await requireRun(ctx.db, experiment.baselineRunId)
          : undefined;
        if (shouldAssignBaseline(existingBaseline?.status)) {
          await ctx.db.patch(experiment._id, { baselineRunId: runId, updatedAt: Date.now() });
        }
      }
      return run._id;
    }

    function canaryHitsForArtifact(artifact: RunArtifact) {
      const triggeredCanaryIds = new Set(
        artifact.traceEvents
          .filter((event) => event.type === "canary")
          .map((event) => event.metadata?.canaryId)
          .filter((canaryId): canaryId is string => typeof canaryId === "string"),
      );
      return artifact.scenario.canaries
        .filter((canary) => triggeredCanaryIds.has(canary.id))
        .map(({ id, label, severity }) => ({ id, label, severity }));
    }

    async function loadComparableRun(ctx: QueryCtx, runId: string) {
      const run = await requireRun(ctx.db, runId);
      try {
        assertComparableStoredRun(run);
      } catch (error) {
        throw new ConvexError(error instanceof Error ? error.message : "Run cannot be compared.");
      }
      return { run, artifact: await loadValidatedArtifact(ctx, run) };
    }

    async function loadValidatedArtifact(
      ctx: QueryCtx | MutationCtx,
      run: Awaited<ReturnType<typeof requireRun>>,
    ) {
      if (!run.runId || !run.scenarioRevisionId || !run.promptRevisionId) {
        throw new ConvexError("Legacy aggregate runs do not contain a full artifact.");
      }
      const artifactJson = await loadArtifactJson(ctx.db, run.runId);
      const artifact = parseStoredRunArtifact(artifactJson);
      const [scenarioRevision, promptRevision] = await Promise.all([
        requireScenarioRevision(ctx.db, run.scenarioRevisionId),
        requirePromptRevision(ctx.db, run.promptRevisionId),
      ]);
      const promptSnapshot = JSON.parse(promptRevision.snapshotJson) as { systemPrompt?: unknown };
      try {
        assertStoredArtifactMatchesRun({
          artifact,
          artifactJson,
          runId: run.runId,
          model: run.model,
          scenarioRevisionId: run.scenarioRevisionId,
          scenarioSnapshotJson: scenarioRevision.snapshotJson,
          promptSystemPrompt: promptSnapshot.systemPrompt,
        });
      } catch (error) {
        throw new ConvexError(error instanceof Error ? error.message : "Run artifact is invalid.");
      }
      return artifact;
    }

    function summarizeArtifact(artifact: RunArtifact) {
      return {
        runId: artifact.runId,
        passed: artifact.evaluation.passed,
        safetyStatus: artifact.evaluation.safety.status,
        taskStatus: artifact.evaluation.task.status,
        totalTokens: totalTokens(artifact),
        cost: totalCost(artifact),
        fileChanges: artifact.files.diff.length,
        errors: artifact.errors.length,
      };
    }

    function totalTokens(artifact: RunArtifact) {
      return artifact.usage.reduce((sum, usage) => sum + usage.totalTokens, 0);
    }

function totalCost(artifact: RunArtifact) {
  return artifact.usage.reduce((sum, usage) => sum + usage.cost.total, 0);
}
