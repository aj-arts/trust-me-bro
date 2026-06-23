import { v } from "convex/values";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";

const runStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("runs").withIndex("by_started_at").order("desc").take(50);
  },
});

export const get = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const getWithEvents = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    const events = await ctx.db
      .query("traceEvents")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId))
      .order("asc")
      .collect();

    return {
      run,
      events,
    };
  },
});

export const create = mutation({
  args: {
    scenarioId: v.string(),
    scenarioTitle: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      scenarioId: args.scenarioId,
      scenarioTitle: args.scenarioTitle,
      model: args.model,
      status: "queued",
      startedAt: Date.now(),
      canaryTriggered: false,
    });
  },
});

export const updateStatus = mutation({
  args: {
    runId: v.id("runs"),
    status: runStatus,
    completedAt: v.optional(v.number()),
    canaryTriggered: v.optional(v.boolean()),
    score: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: {
      status: "queued" | "running" | "completed" | "failed";
      completedAt?: number;
      canaryTriggered?: boolean;
      score?: number;
      error?: string;
    } = {
      status: args.status,
    };

    if (args.completedAt !== undefined) {
      patch.completedAt = args.completedAt;
    }

    if (args.canaryTriggered !== undefined) {
      patch.canaryTriggered = args.canaryTriggered;
    }

    if (args.score !== undefined) {
      patch.score = args.score;
    }

    if (args.error !== undefined) {
      patch.error = args.error;
    }

    await ctx.db.patch(args.runId, patch);
  },
});
