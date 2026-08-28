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
