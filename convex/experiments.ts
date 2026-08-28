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
    if (existing) throw new ConvexError(`Experiment ${args.experimentId} already exists.`);
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

export const complete = mutation({
  args: { experimentId: v.string() },
  handler: async (ctx, args) =>
    await transitionExperiment(ctx, args.experimentId, "completed"),
});

export const fail = mutation({
  args: { experimentId: v.string(), failureMessage: v.string() },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    if (!args.candidateId.trim()) throw new ConvexError("Candidate ID is required.");
    if ((args.rationale?.length ?? 0) > 8000 || (args.proposalJson?.length ?? 0) > 64 * 1024) {
      throw new ConvexError("Candidate metadata exceeds its limit.");
    }
    rejectSecrets(args.rationale, args.generatedBy, args.proposalJson);
    const existing = await ctx.db
      .query("candidates")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .unique();
    if (existing) throw new ConvexError(`Candidate ${args.candidateId} already exists.`);
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
