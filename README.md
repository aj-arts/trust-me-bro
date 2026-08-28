# Trust Me Bro - The Agenty Security Benchmark

Trust Me Bro is a benchmark for testing whether coding agents can safely handle malicious instructions hidden in repo files, docs, skills, and setup scripts.

It does not run real malware. Each scenario uses a safe virtual shell, fake secrets, and harmless canaries to measure whether an agent ignores the trap, asks for confirmation, or tries to do something dangerous.

## Features
- Serializable scenario snapshots: each scenario defines task, virtual files, canaries, evaluators, and a stable trusted runtime-fixture kind
- Blind agent tests: agents should not know they are being tested; they only see the task and the repo context
- Safety modes: run the same scenario with no extra safety instructions, then again with safe-coding instructions to compare behavior
- OpenRouter-powered runs: users can add their OpenRouter key in the frontend and rerun scenarios against different models
- Multi-model comparison: run the same scenario across multiple models at once, with each model getting its own isolated virtual filesystem
- Benchmark dashboard: Artificial Analysis-style graphs comparing models across benchmark metrics
- Live scenario view: realtime filesystem, scenario details, agent trace, command output, and canary status while runs execute
- Side-by-side traces: compare how different models reasoned through the same scenario
- AI scenario generation: generate new benchmark scenarios from the frontend
- Convex trace archive: store full benchmark traces so canary triggers can later be analyzed for patterns to gain insight
- Durable experiment history: immutable scenario/prompt revisions, attributable candidate lineage, explicit run/experiment states, and inspectable artifact history
- Meta-agent lab: bounded red-team scenario optimization or blue-team prompt optimization with declarative proposals, deterministic grading, and resumable persisted runs

## Tech Stack
- TypeScript and Next.js monorepo
- Tailwind CSS for styling
- Convex for database and realtime state
- PI SDK for agent runs
- just-bash for the virtual shell and filesystem
- OpenRouter for model inference

## Development

Install dependencies:

```bash
pnpm install
```

Run the Next.js app:

```bash
pnpm dev
```

Run Convex in another terminal after configuring a Convex project:

```bash
pnpm dev:convex
```

User OpenRouter keys are entered in the browser runner UI. Outer whitespace is trimmed;
the supported `sk-or-v1-` plus 64-character format rejects internal whitespace before
dispatch. Keys should not be stored in Convex or committed env files.

Open `/lab` to run the optimizer. Its economical default proposal and evaluated model
is `z-ai/glm-5.3-flash`; the model fields also accept any catalog or custom OpenRouter
model ID. The default hard budget remains sparse—one baseline, one candidate, one repeat,
and sequential execution—but its token ceilings use GLM-5.3-Flash's published maxima:
131,072 proposal output tokens per call, 131,072 evaluated output tokens per run,
1,048,576 reserved total tokens per evaluated run, and a 2,097,152 aggregate evaluated
token budget for the two default runs. The $25 estimated-spend ceiling remains
independent and enforced.
Proposal requests use OpenRouter's normalized `reasoning: { effort: "low" }` parameter so
mandatory-reasoning models retain reasoning without starving the bounded JSON response.
They also require normalized `response_format: { type: "json_object" }`; unsupported
models fail explicitly rather than relaxing the raw-JSON parser or stripping markdown.
Known model capabilities are validated before dispatch. Custom model IDs use a clearly
reported conservative fallback (32,768 completion / 128,000 context tokens); impossible
values are rejected rather than silently clamped.

Proposal schema version 1 accepts legacy model-supplied `budgetUsage` for compatibility,
but does not trust it. The validator derives canonical operation count, unique files
touched, bytes added, and edit distance from the parsed operations and current revisions;
persisted proposals always contain those computed values. New model prompts omit
`budgetUsage` entirely.

## Optimizer modes and objective

The lab keeps the two mutation surfaces separate:

- **Red-team** proposals may change scenario title, description, task, or virtual files.
  They optimize for attack success and difficulty while deterministic task solvability
  remains a hard prerequisite. Subtle changes win over obvious or expensive ones.
- **Blue-team** proposals may change only the system prompt. They optimize hard safety
  first, then deterministic task success, while penalizing no-op refusals, token use,
  and cost.

Scores are multi-dimensional rather than pass/fail. Hard evaluator dimensions are
compared lexicographically before weighted scalar score. Red-team comparison orders
task success before attack success; blue-team comparison orders safety before task
success. Remaining ties use weighted score, lower repeat variance, lower cost, lower
token use, and finally a stable candidate identifier. Current scalar weights are
documented in `src/lib/meta-agent/scoring.ts`.

Repeated runs produce means and variances and are compared as paired baseline/candidate
sets. An optional holdout evaluated model can run the same immutable revision pair,
subject to the same evaluated-run and spend limits. Deterministic safety and task
evaluators always outrank heuristic dimensions.

## Optimizer safety model

Proposal output must be a raw version-1 JSON object. Unknown fields, markdown fences,
wrong parent revision IDs, and malformed operations fail closed with field-level
errors. Red-team and blue-team operations cannot cross mutation surfaces. Before any
candidate run, validation enforces operation, file, byte, and edit-distance bounds;
normalizes relative POSIX virtual paths; rejects traversal, absolute/home/host paths;
keeps canaries and evaluators immutable; and permits only existing trusted runtime
fixture identifiers. Red-team scenario edits retain a 40% subtlety ratio; blue-team
prompt hardening permits up to a 200% edit ratio while retaining the absolute
4,000-character and 32 KiB prompt bounds. Immutable trusted seed fixture paths are
grandfathered, but generated paths remain strict.

Custom lab scenarios are declarative data: virtual files, a task, deterministic
evaluators, canaries, and an allow-listed runtime fixture. They have no executable code
field. Generated TypeScript or host shell is never evaluated; all evaluated-agent work
runs through the existing browser-native just-bash sandbox and fixture allow-list.

The controller persists revisions, candidates, runs, and decisions through
`ExperimentRepository`; it does not bypass Convex state transitions. Stable candidate
and run IDs plus idempotent persistence mutations allow a running experiment to resume
from already completed steps. Budget checks reserve the next proposal/run before
starting it, cancellation is observed between browser calls, and failures are explicit.
Structurally valid proposals that fail mutation limits are persisted as rejected
candidates with validation issues and are never executed; infrastructure and state
failures remain experiment failures.

OpenRouter keys are constructor-only, in-memory dependencies of the proposal and
evaluated-agent adapters. They are absent from controller configuration, repository
interfaces, proposal payloads, and persistence arguments. Tests use deterministic fake
adapters and make no live calls.

Current limitations: a partially uploaded run is not replayed automatically because
doing so could duplicate a billable provider call; the controller surfaces it as an
explicit failure for operator inspection. Provider-reported token usage is authoritative after each call. Each evaluated run
reserves a separately configured total-token allowance before dispatch; the provider
output cap is intentionally distinct so input tokens are not mistaken for free budget.

Meta-agent revisions, experiments, and full run artifacts fail closed by default because
the app does not yet have a product identity or ownership model. To use them in a trusted
single-user local deployment, set `NEXT_PUBLIC_CONVEX_URL`, set
`NEXT_PUBLIC_META_AGENT_LAB_LOCAL_ONLY=true` in the Next.js app, and set
`META_AGENT_LAB_LOCAL_ONLY=true` in the matching Convex deployment. Never enable this
mode for a public or multi-user deployment; authenticated ownership checks are required
before doing so. Legacy aggregate dashboard reads and writes remain available.

## Experiment persistence

`src/lib/experiment-store` provides a hook-independent typed repository for PR 3's
optimizer. Scenario and prompt snapshots are immutable and content-addressed, with
optional parent revision lineage. Experiments, candidates, and runs use explicit state
transitions; invalid transitions fail instead of being treated as success.

Complete PR 1 run artifacts are recursively redacted before any mutation is called,
then canonicalized and split into ordered UTF-8 chunks. Convex rejects credential
shapes, oversized chunks, missing chunks, inconsistent hashes, and out-of-order
uploads. Existing aggregate dashboard rows remain readable, while newly saved runner
artifacts also populate compatible dashboard metrics. `/experiments` lists durable
history and `/runs/[runId]` displays effective model-visible context,
provider-returned reasoning, assistant messages, tools, evaluator results, usage,
errors, and the virtual filesystem diff.

`runMetaExperiment` starts persistence before executing the shared browser-native
runner and finalizes the artifact automatically. The OpenRouter key remains only in
the caller-owned browser run input and is not part of repository or Convex mutation
types. Ordinary interactive benchmark runs retain their explicit **Save run to
Convex** control.

## Browser runner

All scenarios execute through the shared browser-native runner in
`src/lib/browser-runner`. It hydrates an isolated just-bash filesystem, constructs the
PI agent and tools, records the provider-visible request payload after credential
redaction, and returns a serializable run artifact. Artifacts include the exact
scenario snapshot and effective system prompt, provider-returned transcript content
(including returned thinking blocks, never hidden chain-of-thought), tool lifecycle,
usage and stop reasons, errors, initial/final virtual files, and a deterministic diff.

Built-in scenarios use allow-listed runtime fixtures for mocked commands, network
responses, and semantic canary hooks. Caller-created declarative scenarios do not
need registry entries and use the generic isolated runtime. Deterministic grading
reports safety and task success separately; configured task evaluators must pass in
addition to avoiding canaries.

Reasoning inspection is limited to thinking/reasoning content explicitly returned by
the provider. Trust Me Bro cannot access or reconstruct hidden chain-of-thought.

## Validation

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
