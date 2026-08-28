"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";

export function ExperimentDetailView({ experimentId }: { experimentId: string }) {
  const detail = useQuery(api.experiments.getDetail, { experimentId });

  return (
    <main className="deck-root min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/experiments" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Experiment history
        </Link>
        {detail === undefined ? (
          <p className="mt-10 text-sm text-muted">Loading experiment...</p>
        ) : (
          <>
            <header className="mt-8 rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="deck-label text-accent">{detail.experiment.experimentId}</p>
                  <h1 className="mt-3 font-serif text-4xl font-medium tracking-[-0.03em]">
                    {detail.experiment.name}
                  </h1>
                </div>
                <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {detail.experiment.status}
                </span>
              </div>
              <p className="mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-muted">
                {detail.experiment.objective}
              </p>
              <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-xs sm:grid-cols-2">
                <Revision label="Scenario revision" value={detail.experiment.scenarioRevisionId} />
                <Revision label="Prompt revision" value={detail.experiment.promptRevisionId} />
              </dl>
            </header>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Collection title="Runs" empty="No runs recorded.">
                {detail.runs.map((run) => {
                  const runId = run.runId;
                  const inspectable =
                    run.status !== "running" && Boolean(runId && run.artifactChunkCount);
                  const contents = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{run.model}</p>
                        <p className="mt-1 text-xs text-muted">
                          {run.candidateId ? `Candidate ${run.candidateId}` : "Baseline"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs ${inspectable ? "text-accent" : "text-muted"}`}>
                        {run.status ?? "legacy"} {inspectable ? <ArrowUpRight size={12} /> : null}
                      </span>
                    </>
                  );
                  return inspectable && runId ? (
                    <Link
                      key={runId}
                      href={`/runs/${encodeURIComponent(runId)}`}
                      className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-2"
                    >
                      {contents}
                    </Link>
                  ) : (
                    <div
                      key={run.runId ?? `${run.scenarioId}-${run.startedAt}`}
                      className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                    >
                      {contents}
                    </div>
                  );
                })}
              </Collection>
              <Collection title="Candidates" empty="No candidates recorded.">
                {detail.candidates.map((candidate) => (
                  <article key={candidate.candidateId} className="border-b border-border px-4 py-3 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{candidate.candidateId}</p>
                      <span className="text-xs uppercase text-muted">{candidate.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {candidate.mutationKind} mutation
                      {candidate.parentCandidateId ? ` · parent ${candidate.parentCandidateId}` : ""}
                    </p>
                  </article>
                ))}
              </Collection>
            </div>
            {detail.candidatesTruncated || detail.runsTruncated ? (
              <p className="mt-4 text-xs text-warning">
                This bounded view shows the first {detail.candidates.length} candidates and{" "}
                {detail.runs.length} runs.
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function Revision({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-foreground">{value}</dd>
    </div>
  );
}

function Collection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 font-serif text-xl font-medium">{title}</h2>
      {children.length > 0 ? children : <p className="px-4 py-8 text-sm text-muted">{empty}</p>}
    </section>
  );
}
