import assert from "node:assert/strict";
import test from "node:test";

import {
  baseRunnerModelGroups,
  buildRunnerModelGroups,
} from "./model-catalog.ts";

function modelIds(groups) {
  return groups.flatMap((group) => group.models.map((model) => model.id));
}

test("the base runner catalog contains unique runnable model IDs", () => {
  const ids = modelIds(baseRunnerModelGroups);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("openai/gpt-5.6-sol"));
  assert.ok(ids.includes("x-ai/grok-4.5"));
});

test("legacy and canonical saved model IDs do not create duplicate options", () => {
  const groups = buildRunnerModelGroups([
    "gpt-5-5",
    "openai/gpt-5.5",
    "qwen3-coder",
    "qwen/qwen3-coder:free",
    "custom/example-model",
    "custom/example-model",
  ]);
  const ids = modelIds(groups);

  assert.equal(ids.filter((id) => id === "openai/gpt-5.5").length, 1);
  assert.equal(ids.filter((id) => id === "qwen/qwen3-coder:free").length, 1);
  assert.equal(ids.filter((id) => id === "custom/example-model").length, 1);
  assert.ok(!ids.includes("gpt-5-5"));
  assert.ok(!ids.includes("qwen3-coder"));
  assert.equal(new Set(ids).size, ids.length);
});
