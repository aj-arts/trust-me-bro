import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  assertCandidateTransition,
  assertExperimentTransition,
  assertNoPersistedSecrets,
  type CandidateStatus,
  type ExperimentStatus,
} from "../src/lib/experiment-store/core";
import {
  assertMetaAgentLabAccess,
  requireCandidate,
  requireExperiment,
  requirePromptRevision,
  requireScenarioRevision,
} from "./storageHelpers";

export const create = mutation({
  args: {
    experimentId: v.string(),
    name: v.string(),
    objective: v.string(),
    scenarioRevisionId: v.string(),
    promptRevisionId: v.string(),
  },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    if (!args.experimentId.trim() || !args.name.trim() || !args.objective.trim()) {
      throw new ConvexError("Experiment ID, name, and objective are required.");
    }
    if (args.name.length > 200 || args.objective.length > 4000) {
      throw new ConvexError("Experiment name or objective exceeds its limit.");
    }
    rejectSecrets(args.name, args.objective);
    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_id", (q) => q.eq("experimentId", args.experimentId))
      .unique();
    if (existing) {
      if (
        existing.name === args.name &&
        existing.objective === args.objective &&
        existing.scenarioRevisionId === args.scenarioRevisionId &&
        existing.promptRevisionId === args.promptRevisionId
      ) {
        return existing._id;
      }
      throw new ConvexError(`Experiment ${args.experimentId} already exists with different metadata.`);
    }
    await Promise.all([
      requireScenarioRevision(ctx.db, args.scenarioRevisionId),
      requirePromptRevision(ctx.db, args.promptRevisionId),
    ]);
    const now = Date.now();
    return await ctx.db.insert("experiments", {
      schemaVersion: 1,
      ...args,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const start = mutation({
  args: { experimentId: v.string() },
  handler: async (ctx, args) =>
    await transitionExperiment(ctx, args.experimentId, "running"),
});

export const bindConfiguration = mutation({
  args: { experimentId: v.string(), configurationJson: v.string() },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    if (!args.configurationJson.trim() || args.configurationJson.length > 32 * 1024) {
      throw new ConvexError("Optimizer configuration is invalid.");
    }
    rejectSecrets(args.configurationJson);
    const experiment = await requireExperiment(ctx.db, args.experimentId);
    if (experiment.configurationJson && experiment.configurationJson !== args.configurationJson) {
      throw new ConvexError("Optimizer configuration does not match the persisted experiment.");
    }
    if (!experiment.configurationJson) {
      await ctx.db.patch(experiment._id, {
        configurationJson: args.configurationJson,
        updatedAt: Date.now(),
      });
    }
    return experiment._id;
  },
});

export const reserveProposal = mutation({
  args: {
    experimentId: v.string(),
    attemptId: v.string(),
    candidateId: v.string(),
    modelId: v.string(),
    maxTokens: v.number(),
    estimatedCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    if (
      !args.attemptId.trim() ||
      !args.candidateId.trim() ||
      !args.modelId.trim() ||
      !Number.isInteger(args.maxTokens) ||
      args.maxTokens < 1 ||
      !Number.isFinite(args.estimatedCostUsd) ||
      args.estimatedCostUsd < 0
    ) {
      throw new ConvexError("Proposal reservation is invalid.");
    }
    const experiment = await requireExperiment(ctx.db, args.experimentId);
    if (experiment.status !== "running") {
      throw new ConvexError("Proposal reservations require a running experiment.");
    }
    const existingCandidate = await ctx.db
      .query("candidates")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .unique();
    if (existingCandidate) {
      throw new ConvexError(
        "PROPOSAL_LEASE_CONFLICT: The deterministic candidate already exists.",
      );
    }
    const reservation = {
      attemptId: args.attemptId,
      candidateId: args.candidateId,
      modelId: args.modelId,
      maxTokens: args.maxTokens,
      estimatedCostUsd: args.estimatedCostUsd,
      reservedAt: Date.now(),
    };
    if (experiment.proposalReservation) {
      if (
        experiment.proposalReservation.attemptId === args.attemptId &&
        experiment.proposalReservation.candidateId === args.candidateId &&
        experiment.proposalReservation.modelId === args.modelId &&
        experiment.proposalReservation.maxTokens === args.maxTokens &&
        experiment.proposalReservation.estimatedCostUsd === args.estimatedCostUsd
      ) {
        return experiment._id;
      }
      throw new ConvexError("PROPOSAL_LEASE_CONFLICT: Another proposal attempt is already reserved.");
    }
    await ctx.db.patch(experiment._id, {
      proposalReservation: reservation,
      updatedAt: Date.now(),
    });
    return experiment._id;
  },
});

export const completeProposal = mutation({
  args: { experimentId: v.string(), attemptId: v.string() },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    const experiment = await requireExperiment(ctx.db, args.experimentId);
    if (!experiment.proposalReservation) return experiment._id;
    if (experiment.proposalReservation.attemptId !== args.attemptId) {
      throw new ConvexError("Proposal reservation attempt does not match.");
    }
    await ctx.db.patch(experiment._id, {
      proposalReservation: undefined,
      updatedAt: Date.now(),
    });
    return experiment._id;
  },
});

export const complete = mutation({
  args: { experimentId: v.string() },
  handler: async (ctx, args) =>
    await transitionExperiment(ctx, args.experimentId, "completed"),
});

export const fail = mutation({
  args: { experimentId: v.string(), failureMessage: v.string() },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    if (!args.failureMessage.trim() || args.failureMessage.length > 4000) {
      throw new ConvexError("Experiment failure message is invalid.");
    }
    rejectSecrets(args.failureMessage);
    return await transitionExperiment(ctx, args.experimentId, "failed", args.failureMessage);
  },
});

export const cancel = mutation({
  args: { experimentId: v.string() },
  handler: async (ctx, args) =>
    await transitionExperiment(ctx, args.experimentId, "cancelled"),
});

export const createCandidate = mutation({
  args: {
    candidateId: v.string(),
    experimentId: v.string(),
    parentCandidateId: v.optional(v.string()),
    scenarioRevisionId: v.string(),
    promptRevisionId: v.string(),
    mutationKind: v.union(v.literal("scenario"), v.literal("prompt")),
    rationale: v.optional(v.string()),
    generatedBy: v.optional(v.string()),
    proposalJson: v.optional(v.string()),
    proposalTokens: v.optional(v.number()),
    proposalCostUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    if (!args.candidateId.trim()) throw new ConvexError("Candidate ID is required.");
    if ((args.rationale?.length ?? 0) > 8000 || (args.proposalJson?.length ?? 0) > 64 * 1024) {
      throw new ConvexError("Candidate metadata exceeds its limit.");
    }
    if (
      (args.proposalTokens !== undefined &&
        (!Number.isInteger(args.proposalTokens) || args.proposalTokens < 0)) ||
      (args.proposalCostUsd !== undefined &&
        (!Number.isFinite(args.proposalCostUsd) || args.proposalCostUsd < 0))
    ) {
      throw new ConvexError("Candidate proposal usage is invalid.");
    }
    rejectSecrets(args.rationale, args.generatedBy, args.proposalJson);
    const existing = await ctx.db
      .query("candidates")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .unique();
    if (existing) {
      if (
        existing.experimentId === args.experimentId &&
        existing.parentCandidateId === args.parentCandidateId &&
        existing.scenarioRevisionId === args.scenarioRevisionId &&
        existing.promptRevisionId === args.promptRevisionId &&
        existing.mutationKind === args.mutationKind &&
        existing.rationale === args.rationale &&
        existing.generatedBy === args.generatedBy &&
        existing.proposalJson === args.proposalJson
        && existing.proposalTokens === args.proposalTokens
        && existing.proposalCostUsd === args.proposalCostUsd
      ) {
        return existing._id;
      }
      throw new ConvexError(`Candidate ${args.candidateId} already exists with different metadata.`);
    }
    const experiment = await requireExperiment(ctx.db, args.experimentId);
    if (experiment.status !== "running") {
      throw new ConvexError("Candidates can only be created for a running experiment.");
    }
    await Promise.all([
      requireScenarioRevision(ctx.db, args.scenarioRevisionId),
      requirePromptRevision(ctx.db, args.promptRevisionId),
    ]);
    const parent = args.parentCandidateId
      ? await requireCandidate(ctx.db, args.parentCandidateId)
      : undefined;
    if (parent && parent.experimentId !== args.experimentId) {
      throw new ConvexError("Candidate parent belongs to another experiment.");
    }
    const baseScenario = parent?.scenarioRevisionId ?? experiment.scenarioRevisionId;
    const basePrompt = parent?.promptRevisionId ?? experiment.promptRevisionId;
    if (args.mutationKind === "scenario") {
      if (args.promptRevisionId !== basePrompt || args.scenarioRevisionId === baseScenario) {
        throw new ConvexError("Scenario candidates must change only the scenario revision.");
      }
      const [base, proposed] = await Promise.all([
        requireScenarioRevision(ctx.db, baseScenario),
        requireScenarioRevision(ctx.db, args.scenarioRevisionId),
      ]);
      if (proposed.scenarioId !== base.scenarioId || proposed.parentRevisionId !== base.revisionId) {
        throw new ConvexError("Scenario candidate revision must descend from its attributed parent.");
      }
    } else if (args.scenarioRevisionId !== baseScenario || args.promptRevisionId === basePrompt) {
      throw new ConvexError("Prompt candidates must change only the prompt revision.");
    } else {
      const proposed = await requirePromptRevision(ctx.db, args.promptRevisionId);
      if (proposed.parentRevisionId !== basePrompt) {
        throw new ConvexError("Prompt candidate revision must descend from its attributed parent.");
      }
    }
    return await ctx.db.insert("candidates", {
      schemaVersion: 1,
      ...args,
      status: "proposed",
      createdAt: Date.now(),
    });
  },
});

export const decideCandidate = mutation({
  args: {
    candidateId: v.string(),
    decision: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const candidate = await requireCandidate(ctx.db, args.candidateId);
    if (candidate.status === args.decision) return candidate._id;
    assertCandidateChange(candidate.status, args.decision);
    await ctx.db.patch(candidate._id, {
      status: args.decision,
      decidedAt: Date.now(),
    });
    return candidate._id;
  },
});

export const listHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
    return await ctx.db.query("experiments").withIndex("by_updated_at").order("desc").take(limit);
  },
});

export const getDetail = query({
  args: { experimentId: v.string() },
  handler: async (ctx, args) => {
    const experiment = await requireExperiment(ctx.db, args.experimentId);
    const [candidatePage, runPage] = await Promise.all([
      ctx.db
        .query("candidates")
        .withIndex("by_experiment_created_at", (q) => q.eq("experimentId", args.experimentId))
        .take(51),
      ctx.db
        .query("runs")
        .withIndex("by_experiment_started_at", (q) => q.eq("experimentId", args.experimentId))
        .take(101),
    ]);
    return {
      experiment,
      candidates: candidatePage.slice(0, 50),
      runs: runPage.slice(0, 100),
      candidatesTruncated: candidatePage.length > 50,
      runsTruncated: runPage.length > 100,
    };
  },
});

export const getCandidateAncestry = query({
  args: { candidateId: v.string() },
  handler: async (ctx, args) => {
    const ancestry = [];
    const seen = new Set<string>();
    let candidate = await requireCandidate(ctx.db, args.candidateId);
    while (true) {
      if (seen.has(candidate.candidateId)) {
        throw new ConvexError("Candidate ancestry contains a cycle.");
      }
      seen.add(candidate.candidateId);
      ancestry.push(candidate);
      if (!candidate.parentCandidateId) break;
      if (ancestry.length >= 100) throw new ConvexError("Candidate ancestry exceeds 100 revisions.");
      candidate = await requireCandidate(ctx.db, candidate.parentCandidateId);
    }
    return ancestry;
  },
});

async function transitionExperiment(
  ctx: MutationCtx,
  experimentId: string,
  nextStatus: ExperimentStatus,
  failureMessage?: string,
) {
  const experiment = await requireExperiment(ctx.db, experimentId);
  if (experiment.status === nextStatus) return experiment._id;
  try {
    assertExperimentTransition(experiment.status, nextStatus);
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Invalid experiment transition.");
  }
  const now = Date.now();
  await ctx.db.patch(experiment._id, {
    status: nextStatus,
    updatedAt: now,
    startedAt: nextStatus === "running" ? now : experiment.startedAt,
    completedAt: ["completed", "failed", "cancelled"].includes(nextStatus) ? now : undefined,
    failureMessage,
  });
  return experiment._id;
}

function assertCandidateChange(from: CandidateStatus, to: CandidateStatus) {
  try {
    assertCandidateTransition(from, to);
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Invalid candidate transition.");
  }
}

function rejectSecrets(...values: Array<string | undefined>) {
  try {
    for (const value of values) {
      if (value) assertNoPersistedSecrets(value);
    }
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Value contains a secret.");
  }
}
