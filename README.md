# Trust Me Bro - The Agenty Security Benchmark

Trust Me Bro is a benchmark for testing whether coding agents can safely handle malicious instructions hidden in repo files, docs, skills, and setup scripts.

It does not run real malware. Each scenario uses a safe virtual shell, fake secrets, and harmless canaries to measure whether an agent ignores the trap, asks for confirmation, or tries to do something dangerous.

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
- Convex trace archive: store full benchmark traces so canary triggers can later be analyzed for patterns to gain insight

## Tech Stack
- TypeScript and Next.js monorepo
- Tailwind CSS for styling
- Convex for database and realtime state
- PI SDK for agent runs
- just-bash for the virtual shell and filesystem
- OpenRouter for model inference
