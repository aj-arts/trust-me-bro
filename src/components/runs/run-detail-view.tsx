"use client";

import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import Link from "next/link";

type PersistedRun = {
  _id: GenericId<"runs">;
  scenarioId: string;
  scenarioTitle: string;
  model: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  canaryTriggered: boolean;
  score?: number;
  error?: string;
};

type PersistedTraceEvent = {
  _id: GenericId<"traceEvents">;
  seq: number;
  type: "agent" | "tool_call" | "command" | "file_change" | "canary" | "error" | "status";
  timestamp: number;
  message: string;
  metadata?: unknown;
};

type RunWithEvents = {
  run: PersistedRun | null;
  events: PersistedTraceEvent[];
};

type RunDetailViewProps = {
  runId: GenericId<"runs">;
};

const getRunWithEvents = makeFunctionReference<
  "query",
  { runId: GenericId<"runs"> },
  RunWithEvents
>("runs:getWithEvents");

export function RunDetailView({ runId }: RunDetailViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
        Back to dashboard
      </Link>
      <RunDetailSection runId={runId} />
    </main>
  );
}

function RunDetailSection({ runId }: RunDetailViewProps) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return <EmptyState message="Convex is not configured." />;
  }

  return <PersistedRunDetail runId={runId} />;
}

function PersistedRunDetail({ runId }: RunDetailViewProps) {
  const result = useQuery(getRunWithEvents, { runId });

  if (result === undefined) {
    return <EmptyState message="Loading run..." />;
  }

  if (!result.run) {
    return <EmptyState message="Run not found." />;
  }

  const { run, events } = result;

  return (
    <>
      <section className="rounded-lg border border-border bg-panel p-5">
        <p className="font-mono text-xs uppercase text-muted">{run.scenarioId}</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{run.scenarioTitle}</h1>
            <p className="mt-2 font-mono text-sm text-muted">{run.model}</p>
          </div>
          <span className="w-fit rounded-md border border-border px-2 py-1 text-sm capitalize">
            {run.status}
          </span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm md:grid-cols-4">
          <RunFact label="Canary" value={run.canaryTriggered ? "Triggered" : "Clear"} />
          <RunFact label="Score" value={run.score === undefined ? "-" : String(run.score)} />
          <RunFact label="Started" value={formatTime(run.startedAt)} />
          <RunFact label="Completed" value={run.completedAt ? formatTime(run.completedAt) : "-"} />
        </dl>
        {run.error ? <p className="mt-4 text-sm text-danger">{run.error}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Trace events</h2>
          <p className="mt-1 text-sm text-muted">{events.length} persisted events.</p>
        </div>
        {events.length === 0 ? (
          <EmptyState message="No trace events recorded." />
        ) : (
          <ol className="divide-y divide-border">
            {events.map((event) => (
              <li key={event._id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[160px_minmax(0,1fr)]">
                <div className="font-mono text-xs text-muted">
                  <p>#{event.seq}</p>
                  <p>{formatTime(event.timestamp)}</p>
                  <p className="mt-1 uppercase">{event.type}</p>
                </div>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words leading-6">{event.message}</p>
                  {event.metadata === undefined ? null : (
                    <pre className="mt-3 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function RunFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-border bg-panel px-5 py-8 text-sm text-muted">{message}</div>;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}
