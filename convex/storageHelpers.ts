import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  ARTIFACT_CHUNK_MAX_BYTES,
  ARTIFACT_MAX_CHUNKS,
  REVISION_MAX_BYTES,
  assertNoPersistedSecrets,
  byteLength,
  reassembleArtifactChunks,
  sha256,
} from "../src/lib/experiment-store/core";
import { stableStringify } from "../src/lib/browser-runner/scenarioSnapshot";

type DatabaseReader = QueryCtx["db"] | MutationCtx["db"];

export async function requireScenarioRevision(db: DatabaseReader, revisionId: string) {
  const revision = await db
    .query("scenarioRevisions")
    .withIndex("by_revision_id", (q) => q.eq("revisionId", revisionId))
    .unique();
  if (!revision) throw new ConvexError(`Unknown scenario revision: ${revisionId}.`);
  return revision;
}

export async function requirePromptRevision(db: DatabaseReader, revisionId: string) {
  const revision = await db
    .query("promptRevisions")
    .withIndex("by_revision_id", (q) => q.eq("revisionId", revisionId))
    .unique();
  if (!revision) throw new ConvexError(`Unknown prompt revision: ${revisionId}.`);
  return revision;
}

export async function requireExperiment(db: DatabaseReader, experimentId: string) {
  const experiment = await db
    .query("experiments")
    .withIndex("by_experiment_id", (q) => q.eq("experimentId", experimentId))
    .unique();
  if (!experiment) throw new ConvexError(`Unknown experiment: ${experimentId}.`);
  return experiment;
}

export async function requireCandidate(db: DatabaseReader, candidateId: string) {
  const candidate = await db
    .query("candidates")
    .withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId))
    .unique();
  if (!candidate) throw new ConvexError(`Unknown candidate: ${candidateId}.`);
  return candidate;
}

export async function requireRun(db: DatabaseReader, runId: string) {
  const run = await db
    .query("runs")
    .withIndex("by_run_id", (q) => q.eq("runId", runId))
    .unique();
  if (!run) throw new ConvexError(`Unknown run: ${runId}.`);
  return run;
}

export async function validateRevisionPayload(snapshotJson: string, contentHash: string) {
  try {
    assertNoPersistedSecrets(snapshotJson);
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Revision contains a secret.");
  }
  const size = byteLength(snapshotJson);
  if (size > REVISION_MAX_BYTES) {
    throw new ConvexError(`Revision exceeds the ${REVISION_MAX_BYTES}-byte limit.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    throw new ConvexError("Revision snapshot must be valid JSON.");
  }
  if (stableStringify(parsed) !== snapshotJson) {
    throw new ConvexError("Revision snapshot must use canonical serialization.");
  }
  if ((await sha256(snapshotJson)) !== contentHash) {
    throw new ConvexError("Revision content hash does not match its snapshot.");
  }
  return { parsed, size };
}

export function validateArtifactChunk(args: {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  byteLength: number;
  contentHash: string;
}) {
  if (
    !Number.isInteger(args.chunkIndex) ||
    !Number.isInteger(args.totalChunks) ||
    args.chunkIndex < 0 ||
    args.totalChunks < 1 ||
    args.totalChunks > ARTIFACT_MAX_CHUNKS ||
    args.chunkIndex >= args.totalChunks
  ) {
    throw new ConvexError("Artifact chunk indices are invalid.");
  }
  if (byteLength(args.content) !== args.byteLength || args.byteLength > ARTIFACT_CHUNK_MAX_BYTES) {
    throw new ConvexError("Artifact chunk byte length is invalid.");
  }
  if (!/^[a-f0-9]{64}$/.test(args.contentHash)) {
    throw new ConvexError("Artifact content hash is invalid.");
  }
  assertNoPersistedSecrets(args.content);
}

export async function loadArtifactJson(db: DatabaseReader, runId: string) {
  const chunks = await db
    .query("runEvents")
    .withIndex("by_run_stream_index", (q) =>
      q.eq("runId", runId).eq("stream", "artifact"),
    )
    .collect();
  try {
    return await reassembleArtifactChunks(chunks);
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Run artifact is invalid.");
  }
}
