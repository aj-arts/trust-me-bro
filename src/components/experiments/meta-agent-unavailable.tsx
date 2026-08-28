"use client";

import { FloatingNav } from "@/components/floating-nav";
import { scenarios } from "@/scenarios/registry";

export function MetaAgentUnavailable({ active }: { active: "experiments" | "lab" }) {
  return (
    <main className="deck-root min-h-screen bg-background px-5 pb-16 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <FloatingNav active={active} runnerHref={`/run/${scenarios[0]?.id ?? ""}`} />
        <section
          role="status"
          className="mt-12 rounded-2xl border border-border bg-surface p-6"
        >
          <h1 className="font-serif text-3xl font-medium">Meta-agent lab unavailable</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            This deployment has not explicitly enabled local-only experiment persistence.
            Configure both the app and Convex opt-in flags only in a trusted single-user
            environment.
          </p>
        </section>
      </div>
    </main>
  );
}
