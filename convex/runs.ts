import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    return await ctx.db.query("runs").withIndex("by_saved_at").order("desc").take(2000);
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
