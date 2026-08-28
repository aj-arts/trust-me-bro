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

User OpenRouter keys are entered in the browser runner UI. They should not be stored in Convex or committed env files.

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
