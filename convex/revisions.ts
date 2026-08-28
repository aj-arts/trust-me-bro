import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertMetaAgentLabAccess,
  requirePromptRevision,
  requireScenarioRevision,
  validateRevisionPayload,
} from "./storageHelpers";

const promptMode = v.union(
  v.literal("safe"),
  v.literal("neutral"),
  v.literal("permissive"),
);

export const createScenario = mutation({
  args: {
    revisionId: v.string(),
    contentHash: v.string(),
    parentRevisionId: v.optional(v.string()),
    snapshotJson: v.string(),
  },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    const { parsed, size } = await validateRevisionPayload(args.snapshotJson, args.contentHash);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).schemaVersion !== 1 ||
      typeof (parsed as Record<string, unknown>).id !== "string" ||
      (parsed as Record<string, unknown>).revisionId !== args.revisionId
    ) {
      throw new ConvexError("Scenario revision snapshot is invalid.");
    }
    const scenarioId = (parsed as Record<string, unknown>).id as string;
    const existing = await ctx.db
      .query("scenarioRevisions")
      .withIndex("by_revision_id", (q) => q.eq("revisionId", args.revisionId))
      .unique();
    if (existing) {
      if (
        existing.contentHash !== args.contentHash ||
        existing.snapshotJson !== args.snapshotJson ||
        existing.parentRevisionId !== args.parentRevisionId
      ) {
        throw new ConvexError(`Scenario revision ${args.revisionId} already has different content.`);
      }
      return existing._id;
    }
    if (args.parentRevisionId) {
      if (args.parentRevisionId === args.revisionId) {
        throw new ConvexError("Scenario revision cannot be its own parent.");
      }
      const parent = await requireScenarioRevision(ctx.db, args.parentRevisionId);
      if (parent.scenarioId !== scenarioId) {
        throw new ConvexError("Scenario revision parent belongs to a different scenario.");
      }
    }
    return await ctx.db.insert("scenarioRevisions", {
      schemaVersion: 1,
      revisionId: args.revisionId,
      contentHash: args.contentHash,
      scenarioId,
      parentRevisionId: args.parentRevisionId,
      snapshotJson: args.snapshotJson,
      byteLength: size,
      createdAt: Date.now(),
    });
  },
});

export const createPrompt = mutation({
  args: {
    revisionId: v.string(),
    contentHash: v.string(),
    parentRevisionId: v.optional(v.string()),
    systemPromptMode: promptMode,
    snapshotJson: v.string(),
  },
  handler: async (ctx, args) => {
    assertMetaAgentLabAccess();
    const { parsed, size } = await validateRevisionPayload(args.snapshotJson, args.contentHash);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).schemaVersion !== 1 ||
      (parsed as Record<string, unknown>).systemPromptMode !== args.systemPromptMode ||
      typeof (parsed as Record<string, unknown>).systemPrompt !== "string" ||
      args.revisionId !== `prompt-${args.contentHash}`
    ) {
      throw new ConvexError("Prompt revision snapshot is invalid.");
    }
    const existing = await ctx.db
      .query("promptRevisions")
      .withIndex("by_revision_id", (q) => q.eq("revisionId", args.revisionId))
      .unique();
    if (existing) {
      if (
        existing.contentHash !== args.contentHash ||
        existing.snapshotJson !== args.snapshotJson ||
        existing.parentRevisionId !== args.parentRevisionId
      ) {
        throw new ConvexError(`Prompt revision ${args.revisionId} already has different content.`);
      }
      return existing._id;
    }
    if (args.parentRevisionId) {
      if (args.parentRevisionId === args.revisionId) {
        throw new ConvexError("Prompt revision cannot be its own parent.");
      }
      await requirePromptRevision(ctx.db, args.parentRevisionId);
    }
    return await ctx.db.insert("promptRevisions", {
      schemaVersion: 1,
      revisionId: args.revisionId,
      contentHash: args.contentHash,
      parentRevisionId: args.parentRevisionId,
      systemPromptMode: args.systemPromptMode,
      snapshotJson: args.snapshotJson,
      byteLength: size,
      createdAt: Date.now(),
    });
  },
});

export const getScenario = query({
  args: { revisionId: v.string() },
  handler: async (ctx, args) => await requireScenarioRevision(ctx.db, args.revisionId),
});

export const getPrompt = query({
  args: { revisionId: v.string() },
  handler: async (ctx, args) => await requirePromptRevision(ctx.db, args.revisionId),
});
