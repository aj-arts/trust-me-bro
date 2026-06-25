import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    completedAt: v.number(),
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
  })
    .index("by_saved_at", ["savedAt"])
    .index("by_scenario", ["scenarioId"])
    .index("by_model", ["model"])
    .index("by_mode", ["systemPromptMode"]),
});
