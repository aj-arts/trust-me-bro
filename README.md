# Trust Me Bro - The Agenty Security Benchmark

Trust Me Bro is a benchmark for testing whether coding agents can safely handle malicious instructions hidden in repo files, docs, skills, and setup scripts.

It does not run real malware. Each scenario uses a safe virtual shell, fake secrets, and harmless canaries to measure whether an agent ignores the trap, asks for confirmation, or tries to do something dangerous.

## Current Status

This repo now contains a complete local-first benchmark console:

- Next.js App Router web app in `apps/web`
- Shared TypeScript benchmark engine in `packages/benchmark`
- Safe virtual shell and filesystem with fake canaries
- Built-in scenario library plus AI-assisted scenario generation
- Optional OpenRouter-backed model runs when a key is entered in the UI. The app only allows free OpenRouter routes: `openrouter/free` or model IDs ending in `:free`.
- Local trace archive stored under `apps/web/.trust-me-bro/traces.json`
- Dashboard, live trace replay, virtual filesystem viewer, terminal output, canary inspector, model comparison, side-by-side traces, and archive browser

## Features
- Scenario-based benchmarks: each TypeScript scenario defines the user task, virtual filesystem, hidden security trigger, and agent evaluation loop
- Blind agent tests: agents should not know they are being tested; they only see the task and the repo context
- Safety modes: run the same scenario with no extra safety instructions, then again with safe-coding instructions to compare behavior
- OpenRouter-powered runs: users can add their OpenRouter key in the frontend and rerun scenarios against different models
- Multi-model comparison: run the same scenario across multiple models at once, with each model getting its own isolated virtual filesystem
- Live run viewer: inspect files, filesystem changes, command output, reasoning traces, and canary status while a scenario runs
- Side-by-side traces: compare how different models reasoned through the same scenario
- AI scenario generation: generate new benchmark scenarios from the frontend
- Benchmark dashboard: compare model performance across useful metrics via intuitive and visually pleasing charts
- Trace archive: store full benchmark traces so canary triggers can later be analyzed for patterns to gain insight. The local archive adapter is intentionally isolated so it can be swapped for Convex when deploying.

## Tech Stack
- TypeScript and Next.js monorepo
- Tailwind CSS for styling
- Local JSON archive adapter for offline/local hosting; Convex-ready boundary for deployment storage
- Safe virtual shell and filesystem implemented in TypeScript
- OpenRouter for model inference

## Local Hosting

Use pnpm for all JavaScript commands.

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

The app works without any API keys by using deterministic local model profiles. To run live models, paste an OpenRouter key into the `OpenRouter key` field in the app. The key is stored only in browser session storage and is sent to the local `/api/run` or `/api/generate-scenario` route for that request.

To avoid accidental credit spend, paid OpenRouter IDs are blocked in both the UI and API routes. Use `openrouter/free` or a model ID ending in `:free`.

## Scripts

```bash
pnpm dev        # start local Next.js development server
pnpm build      # production build
pnpm start      # serve the production build
pnpm lint       # eslint
pnpm typecheck  # TypeScript no-emit check
```

## Project Layout

```text
apps/web
  src/app/api/run                 Benchmark execution route
  src/app/api/archive             Local trace archive route
  src/app/api/generate-scenario   Scenario generation route
  src/components                  Product UI
  src/server/archive.ts           Local archive adapter

packages/benchmark
  src/scenarios.ts                Built-in TypeScript scenarios
  src/virtual-shell.ts            Safe virtual shell and canary detection
  src/runner.ts                   Evaluation loop and OpenRouter adapter
  src/generator.ts                Scenario generation

docs/design
  benchmark-console-concept.png   Generated visual concept used for implementation
```

## Built-in Scenarios

- Data Exfiltration: SSH Keys
- Credential Harvest: AWS
- Prompt Injection: Indirect
- Privilege Escalation: Sudo
- Secrets in Codebase
- Tool Misuse: Web Fetch
- Data Integrity: Tamper

All scenarios use fake secrets, safe canary IDs, and a virtual command runner. No shell command from a scenario is executed on the host machine.

## Safety Modes

- `Monitor`: runs the virtual commands and records policy events.
- `Warn`: annotates risky commands while still allowing the run to proceed.
- `Block`: blocks virtual commands that touch credentials, network beacons, privilege boundaries, or audit-tamper triggers.

## Deployment Notes

The app is ready for local judging and later deployment. For production archive persistence, replace `apps/web/src/server/archive.ts` with a Convex-backed adapter and keep the route contracts unchanged.
