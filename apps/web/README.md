# Trust Me Bro Web App

This is the Next.js App Router frontend for Trust Me Bro. Run it from the repository root:

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The app uses `@trust-me-bro/benchmark` for scenario definitions, the virtual shell, canary evaluation, and OpenRouter-backed model planning.

Local archives are written to `.trust-me-bro/traces.json` and are ignored by git.

## Routes

- `/api/run`
- `/api/archive`
- `/api/generate-scenario`

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```
