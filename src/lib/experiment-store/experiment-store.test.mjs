import assert from "node:assert/strict";
import test from "node:test";

import { createScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import {
  assertCandidateTransition,
  assertExperimentTransition,
  assertRunTransition,
  chunkArtifact,
  parseStoredRunArtifact,
  preparePromptRevision,
  prepareScenarioRevision,
  reassembleArtifactChunks,
  serializeRunArtifact,
  sha256,
} from "./core.ts";
import { ConvexExperimentRepository } from "./repository.ts";

function artifactFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "run-fixture",
    scenario: createScenarioSnapshot({
      id: "fixture",
      title: "Fixture",
      description: "Deterministic storage fixture.",
      userTask: "Update value.txt.",
      files: { "value.txt": "before" },
      canaries: [],
      evaluators: [
        {
          id: "changed",
          dimension: "task",
          kind: "file_changed",
          path: "value.txt",
        },
      ],
    }),
    effectiveSystemPrompt: "Complete the task safely.",
    model: "fixture/model",
    startedAt: 1,
    completedAt: 2,
    transcript: [{ role: "assistant", content: "Done." }],
    traceEvents: [{ seq: 0, type: "agent", timestamp: 2, message: "Done." }],
    toolInvocations: [],
    providerRequests: [],
    usage: [
      {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    ],
    stopReasons: ["stop"],
    errors: [],
    files: {
      initial: { "/workspace/value.txt": "before" },
      final: { "/workspace/value.txt": "after" },
      diff: [
        {
          path: "/workspace/value.txt",
          kind: "modified",
          before: "before",
          after: "after",
        },
      ],
    },
    evaluation: {
      passed: true,
      safety: { status: "passed", assertions: [] },
      task: { status: "passed", assertions: [] },
    },
    ...overrides,
  };
}

test("scenario and prompt revisions have deterministic content identities", async () => {
  const first = createScenarioSnapshot({
    id: "ordered",
    title: "Ordered",
    description: "Stable identity.",
    userTask: "Inspect.",
    files: { "z.txt": "z", "a.txt": "a" },
    canaries: [],
  });
  const second = createScenarioSnapshot({
    id: "ordered",
    title: "Ordered",
    description: "Stable identity.",
    userTask: "Inspect.",
    files: { "a.txt": "a", "z.txt": "z" },
    canaries: [],
  });
  const [firstRevision, secondRevision, promptA, promptB] = await Promise.all([
    prepareScenarioRevision(first),
    prepareScenarioRevision(second),
    preparePromptRevision("Prompt", "safe"),
    preparePromptRevision("Prompt", "safe"),
  ]);

  assert.equal(firstRevision.revisionId, secondRevision.revisionId);
  assert.equal(firstRevision.contentHash, secondRevision.contentHash);
  assert.equal(firstRevision.snapshotJson, secondRevision.snapshotJson);
  assert.equal(promptA.revisionId, promptB.revisionId);
  assert.match(promptA.revisionId, /^prompt-[a-f0-9]{64}$/);
});

test("persistence serialization excludes sensitive field names and values", async () => {
  const artifact = artifactFixture({
    providerRequests: [
      {
        sequence: 0,
        timestamp: 1,
        model: "fixture/model",
        payload: {
          headers: {
            authorization: "Bearer abcdefghijklmnop",
            cookie: "session=private",
            "x-api-key": "provider-secret",
          },
          apiKey: "sk-or-v1-supersecret",
          nested: [["Authorization", "Bearer anotherlongcredential"]],
          safe: "visible",
        },
      },
    ],
  });
  const { artifactJson } = await serializeRunArtifact(artifact);

  assert.ok(!artifactJson.toLowerCase().includes('"authorization":'));
  assert.ok(!artifactJson.toLowerCase().includes('"cookie":'));
  assert.ok(!artifactJson.toLowerCase().includes('"apikey":'));
  assert.ok(!artifactJson.includes("supersecret"));
  assert.ok(!artifactJson.includes("private"));
  assert.ok(!artifactJson.includes("anotherlongcredential"));
  assert.ok(artifactJson.includes("visible"));
});

test("artifact chunks preserve UTF-8 and reject missing or out-of-order streams", async () => {
  const value = JSON.stringify({ text: `start-${"😀".repeat(40)}-end` });
  const hash = await sha256(value);
  const chunks = chunkArtifact(value, hash, 17);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.byteLength <= 17));
  assert.equal(await reassembleArtifactChunks(chunks), value);
  await assert.rejects(
    reassembleArtifactChunks(chunks.slice(1)),
    /missing chunks|out of order/,
  );
  await assert.rejects(
    reassembleArtifactChunks([chunks[1], chunks[0], ...chunks.slice(2)]),
    /out of order/,
  );
});

test("invalid experiment, candidate, and run transitions are explicit", () => {
  assert.doesNotThrow(() => assertExperimentTransition("draft", "running"));
  assert.doesNotThrow(() => assertExperimentTransition("running", "completed"));
  assert.throws(() => assertExperimentTransition("draft", "completed"), /Invalid experiment transition/);
  assert.throws(() => assertExperimentTransition("completed", "running"), /Invalid experiment transition/);
  assert.doesNotThrow(() => assertCandidateTransition("proposed", "accepted"));
  assert.throws(() => assertCandidateTransition("accepted", "rejected"), /Invalid candidate transition/);
  assert.doesNotThrow(() => assertRunTransition("running", "failed"));
  assert.throws(() => assertRunTransition("failed", "completed"), /Invalid run transition/);
});

test("run artifacts round trip through redaction, chunking, and parsing", async () => {
  const artifact = artifactFixture();
  const serialized = await serializeRunArtifact(artifact);
  const chunks = chunkArtifact(serialized.artifactJson, serialized.artifactHash, 83);
  const restored = parseStoredRunArtifact(await reassembleArtifactChunks(chunks));

  assert.deepEqual(restored, JSON.parse(JSON.stringify(artifact)));
});

test("stored artifact parsing rejects incomplete nested structures", () => {
  const artifact = artifactFixture();
  delete artifact.errors;

  assert.throws(
    () => parseStoredRunArtifact(JSON.stringify(artifact)),
    /does not match schema version 1/,
  );
});

test("repository mutations never receive provider credentials", async () => {
  const mutations = [];
  const client = {
    mutation: async (_reference, args) => {
      mutations.push(args);
      return "fake-id";
    },
    query: async () => {
      throw new Error("Unexpected query.");
    },
  };
  const repository = new ConvexExperimentRepository(client);
  const artifact = artifactFixture({
    providerRequests: [
      {
        sequence: 0,
        timestamp: 1,
        model: "fixture/model",
        payload: {
          authorization: "Bearer abcdefghijklmnop",
          apiKey: "sk-or-v1-never-persist",
          safe: "visible",
        },
      },
    ],
  });

  await repository.persistBenchmarkRun({ status: "completed", artifact }, "neutral");
  const mutationJson = JSON.stringify(mutations);
  assert.ok(!mutationJson.includes("never-persist"));
  assert.ok(!mutationJson.toLowerCase().includes('"authorization"'));
  assert.ok(!mutationJson.toLowerCase().includes('"apikey"'));
  assert.ok(mutationJson.includes("visible"));
});

test("repository aborts a run whose artifact cannot fit bounded storage", async () => {
  const mutations = [];
  const repository = new ConvexExperimentRepository({
    mutation: async (_reference, args) => {
      mutations.push(args);
      return "fake-id";
    },
    query: async () => {
      throw new Error("Unexpected query.");
    },
  });
  const artifact = artifactFixture({
    transcript: ["x".repeat(4 * 1024 * 1024)],
  });

  await assert.rejects(
    repository.finishRun({ status: "completed", artifact }),
    /maximum|exceed/,
  );
  assert.ok(
    mutations.some((args) => args.runId === artifact.runId && args.reason === "artifact_too_large"),
  );
});
