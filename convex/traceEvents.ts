import { v } from "convex/values";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";

const traceEventType = v.union(
  v.literal("agent"),
  v.literal("tool_call"),
  v.literal("command"),
  v.literal("file_change"),
  v.literal("canary"),
  v.literal("error"),
  v.literal("status"),
);

export const listByRun = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("traceEvents")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId))
      .order("asc")
      .collect();
  },
});

export const append = mutation({
  args: {
    runId: v.id("runs"),
    seq: v.number(),
    type: traceEventType,
    timestamp: v.number(),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("traceEvents", {
      runId: args.runId,
      seq: args.seq,
      type: args.type,
      timestamp: args.timestamp,
      message: args.message,
      metadata: args.metadata,
    });
  },
});
