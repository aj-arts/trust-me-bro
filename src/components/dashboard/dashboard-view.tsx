"use client";

import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { scenarios } from "@/scenarios/registry";

type RecentRun = {
  _id: string;
  scenarioId: string;
  scenarioTitle: string;
  model: string;
  systemPromptMode?: "safe" | "neutral" | "permissive";
  status: "queued" | "running" | "completed" | "failed";
  canaryTriggered: boolean;
  score?: number;
};

const listRuns = makeFunctionReference<"query", Record<string, never>, RecentRun[]>("runs:list");

export function DashboardView() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return <DashboardContent runs={null} />;
  }

  return <DashboardWithRuns />;
}

function DashboardWithRuns() {
  const runs = useQuery(listRuns, {});

  return <DashboardContent runs={runs} />;
}

function DashboardContent({ runs }: { runs: RecentRun[] | undefined | null }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <p className="font-mono text-sm text-muted">Trust Me Bro</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Benchmark Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Review available scenarios and persisted runner results.
            </p>
          </div>
          <Link
            href={`/run/${scenarios[0]?.id ?? ""}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Open runner
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <Link
            key={scenario.id}
            href={`/run/${scenario.id}`}
            className="rounded-lg border border-border bg-panel p-5 transition hover:border-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{scenario.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{scenario.description}</p>
                {runs !== null ? (
                  <ScenarioRunSummary
                    run={runs?.find((run) => run.scenarioId === scenario.id)}
                    isLoading={runs === undefined}
                  />
                ) : null}
              </div>
              <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted">
                {scenario.canaries.length} canary
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Recent runs</h2>
          <p className="mt-1 text-sm text-muted">Latest persisted runner results.</p>
        </div>
        <div className="grid grid-cols-6 border-b border-border px-5 py-3 font-mono text-xs uppercase text-muted">
          <span>Scenario</span>
          <span>Model</span>
          <span>Mode</span>
          <span>Status</span>
          <span>Canary</span>
          <span>Score</span>
        </div>
        <RecentRunsSection runs={runs} />
      </section>
    </main>
  );
}

function ScenarioRunSummary({ run, isLoading }: { run?: RecentRun; isLoading: boolean }) {
  if (isLoading) {
    return <p className="mt-4 font-mono text-xs text-muted">Loading latest run...</p>;
  }

  if (!run) {
    return <p className="mt-4 font-mono text-xs text-muted">No runs yet</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
      <span className="capitalize">{run.status}</span>
      <span>{formatSystemPromptMode(run.systemPromptMode)}</span>
      <span>{run.canaryTriggered ? "Canary triggered" : "Canary clear"}</span>
      <span>Score {formatScore(run.score)}</span>
    </div>
  );
}

function RecentRunsSection({ runs }: { runs: RecentRun[] | undefined | null }) {
  if (runs === null) {
    return <div className="px-5 py-8 text-sm text-muted">Convex is not configured.</div>;
  }

  if (runs === undefined) {
    return <div className="px-5 py-8 text-sm text-muted">Loading runs...</div>;
  }

  if (runs.length === 0) {
    return <div className="px-5 py-8 text-sm text-muted">No runs recorded yet.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {runs.map((run) => (
        <Link
          key={run._id}
          href={`/runs/${run._id}`}
          className="grid grid-cols-6 gap-3 px-5 py-3 text-sm transition hover:bg-background"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{run.scenarioTitle}</p>
            <p className="truncate font-mono text-xs text-muted">{run.scenarioId}</p>
          </div>
          <span className="truncate font-mono text-xs text-muted">{run.model}</span>
          <span>{formatSystemPromptMode(run.systemPromptMode)}</span>
          <span className="capitalize">{run.status}</span>
          <span>{run.canaryTriggered ? "Triggered" : "Clear"}</span>
          <span>{formatScore(run.score)}</span>
        </Link>
      ))}
    </div>
  );
}

function formatSystemPromptMode(mode?: RecentRun["systemPromptMode"]) {
  return mode ? mode[0].toUpperCase() + mode.slice(1) : "-";
}

function formatScore(score?: number) {
  return score === undefined ? "-" : score;
}
