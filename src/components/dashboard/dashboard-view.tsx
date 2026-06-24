"use client";

import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { useState, type ReactNode } from "react";
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
const systemPromptModes = ["safe", "neutral", "permissive"] as const;
const runStatuses = ["queued", "running", "completed", "failed"] as const;

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

      {runs !== null ? <ModeComparisonSection runs={runs} /> : null}

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Recent runs</h2>
          <p className="mt-1 text-sm text-muted">Latest persisted runner results.</p>
        </div>
        <RecentRunsSection runs={runs} />
      </section>
    </main>
  );
}

function ModeComparisonSection({ runs }: { runs: RecentRun[] | undefined }) {
  if (runs === undefined) {
    return (
      <section className="rounded-lg border border-border bg-panel px-5 py-4">
        <h2 className="text-base font-semibold">Mode comparison</h2>
        <p className="mt-2 text-sm text-muted">Loading mode comparison...</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">Mode comparison</h2>
        <p className="mt-1 text-sm text-muted">Latest run for each scenario and prompt mode.</p>
      </div>
      <div className="grid grid-cols-4 border-b border-border px-5 py-3 font-mono text-xs uppercase text-muted">
        <span>Scenario</span>
        {systemPromptModes.map((mode) => (
          <span key={mode}>{formatSystemPromptMode(mode)}</span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="grid grid-cols-4 gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{scenario.title}</p>
              <p className="truncate font-mono text-xs text-muted">{scenario.id}</p>
            </div>
            {systemPromptModes.map((mode) => (
              <ModeComparisonCell
                key={mode}
                run={runs.find((run) => run.scenarioId === scenario.id && run.systemPromptMode === mode)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModeComparisonCell({ run }: { run?: RecentRun }) {
  if (!run) {
    return <span className="font-mono text-xs text-muted">No run</span>;
  }

  return (
    <Link
      href={`/runs/${run._id}`}
      className="min-w-0 rounded-md border border-border px-3 py-2 transition hover:border-accent"
    >
      <span className="block font-mono text-xs">Score {formatScore(run.score)}</span>
      <span className="mt-1 block text-xs text-muted">
        {run.canaryTriggered ? "Canary triggered" : "Canary clear"}
      </span>
      <span className="mt-1 block truncate font-mono text-xs text-muted">
        {run.model} - {run.status}
      </span>
    </Link>
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
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  if (runs === null) {
    return <div className="px-5 py-8 text-sm text-muted">Convex is not configured.</div>;
  }

  if (runs === undefined) {
    return <div className="px-5 py-8 text-sm text-muted">Loading runs...</div>;
  }

  if (runs.length === 0) {
    return <div className="px-5 py-8 text-sm text-muted">No runs recorded yet.</div>;
  }

  const scenarioOptions = Array.from(
    new Map(runs.map((run) => [run.scenarioId, run.scenarioTitle] as const)),
  );
  const filteredRuns = runs.filter((run) => {
    return (
      (scenarioFilter === "all" || run.scenarioId === scenarioFilter) &&
      (modeFilter === "all" || run.systemPromptMode === modeFilter) &&
      (statusFilter === "all" || run.status === statusFilter)
    );
  });
  const exportFilteredRuns = () => {
    downloadCsv("filtered-runs.csv", runsToCsv(filteredRuns));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <RecentRunsFilter label="Scenario" value={scenarioFilter} onChange={setScenarioFilter}>
          <option value="all">All scenarios</option>
          {scenarioOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </RecentRunsFilter>
        <RecentRunsFilter label="Mode" value={modeFilter} onChange={setModeFilter}>
          <option value="all">All modes</option>
          {systemPromptModes.map((mode) => (
            <option key={mode} value={mode}>
              {formatSystemPromptMode(mode)}
            </option>
          ))}
        </RecentRunsFilter>
        <RecentRunsFilter label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="all">All statuses</option>
          {runStatuses.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </RecentRunsFilter>
        <button
          type="button"
          onClick={exportFilteredRuns}
          disabled={filteredRuns.length === 0}
          className="ml-auto inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-6 border-b border-border px-5 py-3 font-mono text-xs uppercase text-muted">
        <span>Scenario</span>
        <span>Model</span>
        <span>Mode</span>
        <span>Status</span>
        <span>Canary</span>
        <span>Score</span>
      </div>
      {filteredRuns.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted">No runs match these filters.</div>
      ) : (
        <div className="divide-y divide-border">
          {filteredRuns.map((run) => (
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
      )}
    </>
  );
}

function RecentRunsFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="font-mono uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
      >
        {children}
      </select>
    </label>
  );
}

function formatSystemPromptMode(mode?: RecentRun["systemPromptMode"]) {
  return mode ? mode[0].toUpperCase() + mode.slice(1) : "-";
}

function formatStatus(status: RecentRun["status"]) {
  return status[0].toUpperCase() + status.slice(1);
}

function formatScore(score?: number) {
  return score === undefined ? "-" : score;
}

function runsToCsv(runs: RecentRun[]) {
  const columns = [
    "scenarioId",
    "scenarioTitle",
    "model",
    "systemPromptMode",
    "status",
    "canaryTriggered",
    "score",
    "runPath",
  ];
  const rows = runs.map((run) => [
    run.scenarioId,
    run.scenarioTitle,
    run.model,
    run.systemPromptMode ?? "",
    run.status,
    String(run.canaryTriggered),
    run.score ?? "",
    `/runs/${run._id}`,
  ]);

  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number | boolean) {
  const text = String(value);

  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
