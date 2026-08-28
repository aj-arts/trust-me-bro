"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { FloatingNav } from "@/components/floating-nav";
import { scenarios } from "@/scenarios/registry";

export function ExperimentHistoryView() {
  const experiments = useQuery(api.experiments.listHistory, { limit: 100 });
  const runnerHref = `/run/${scenarios[0]?.id ?? ""}`;

  return (
    <main className="deck-root min-h-screen bg-background px-5 pb-16 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <FloatingNav active="experiments" runnerHref={runnerHref} />
        <header className="pb-8 pt-12">
          <p className="deck-label text-accent">Durable experiment history</p>
          <h1 className="mt-3 font-serif text-5xl font-medium tracking-[-0.04em]">
            Experiments
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Inspect revision lineage and complete redacted run artifacts. Candidate generation and
            optimization are intentionally outside this storage layer.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          {experiments === undefined ? (
            <p className="px-5 py-10 text-sm text-muted">Loading experiment history...</p>
          ) : experiments.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-16 text-center">
              <FlaskConical className="text-muted" size={30} />
              <p className="mt-4 font-medium">No experiments persisted yet</p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                PR 3 can create experiments through the typed repository without binding its state
                machine to React or Convex hooks.
              </p>
            </div>
          ) : (
            experiments.map((experiment) => (
              <Link
                key={experiment.experimentId}
                href={`/experiments/${encodeURIComponent(experiment.experimentId)}`}
                className="grid gap-3 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-surface-2 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-serif text-xl font-medium">{experiment.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                    {experiment.objective}
                  </p>
                </div>
                <StatusBadge status={experiment.status} />
                <span className="inline-flex items-center gap-1 text-xs text-accent">
                  Inspect <ArrowUpRight size={13} />
                </span>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="w-fit rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">
      {status}
    </span>
  );
}
