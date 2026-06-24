import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    scenarioId: v.string(),
    scenarioTitle: v.string(),
    model: v.string(),
    systemPromptMode: v.optional(v.union(v.literal("safe"), v.literal("neutral"), v.literal("permissive"))),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    canaryTriggered: v.boolean(),
    score: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_started_at", ["startedAt"])
    .index("by_scenario", ["scenarioId"]),

  traceEvents: defineTable({
    runId: v.id("runs"),
    seq: v.number(),
    type: v.union(
      v.literal("agent"),
      v.literal("tool_call"),
      v.literal("command"),
      v.literal("file_change"),
      v.literal("canary"),
      v.literal("error"),
      v.literal("status"),
    ),
    timestamp: v.number(),
    message: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_run_seq", ["runId", "seq"]),
});
