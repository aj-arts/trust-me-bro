"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { JsonValue } from "@/lib/browser-runner/types";
import { useMetaAgentLabConfigured } from "@/components/providers/convex-client-provider";
import { MetaAgentUnavailable } from "./meta-agent-unavailable";

export function RunDetailView({ runId }: { runId: string }) {
  const configured = useMetaAgentLabConfigured();
  return configured ? (
    <ConnectedRunDetailView runId={runId} />
  ) : (
    <MetaAgentUnavailable active="experiments" />
  );
}

function ConnectedRunDetailView({ runId }: { runId: string }) {
  const detail = useQuery(api.runs.loadFullDetail, { runId });

  if (detail === undefined) {
    return <main className="deck-root min-h-screen bg-background p-8 text-sm text-muted">Loading run artifact...</main>;
  }

  const artifact = detail.artifact;
  const reasoning = artifact.traceEvents.filter((event) => event.type === "reasoning");
  const assistantMessages = artifact.traceEvents.filter((event) => event.type === "agent");

  return (
    <main className="deck-root min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={detail.run.experimentId ? `/experiments/${encodeURIComponent(detail.run.experimentId)}` : "/experiments"}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <header className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="deck-label text-accent">{artifact.runId}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-4xl font-medium tracking-[-0.03em]">
                {artifact.scenario.title}
              </h1>
              <p className="mt-2 text-sm text-muted">{artifact.model}</p>
            </div>
            <Verdict passed={artifact.evaluation.passed} status={detail.run.status} />
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Section title="Effective model-visible context">
            <TextBlock label="Effective system prompt" text={artifact.effectiveSystemPrompt} />
            <TextBlock label="User task" text={artifact.scenario.userTask} />
            <JsonBlock label="Provider request payloads" value={artifact.providerRequests} />
          </Section>
          <Section title="Provider-returned reasoning">
            {reasoning.length > 0 ? (
              reasoning.map((event) => <TextBlock key={event.seq} label={`Event ${event.seq}`} text={event.message} />)
            ) : (
              <Empty text="The provider returned no reasoning blocks." />
            )}
          </Section>
          <Section title="Assistant messages and transcript">
            {assistantMessages.map((event) => (
              <TextBlock key={event.seq} label={`Message ${event.seq}`} text={event.message} />
            ))}
            <JsonBlock label="Complete PI transcript" value={artifact.transcript} />
          </Section>
          <Section title="Tool calls and results">
            {artifact.toolInvocations.length > 0 ? (
              artifact.toolInvocations.map((tool) => (
                <JsonBlock key={tool.toolCallId} label={`${tool.toolName} · ${tool.toolCallId}`} value={tool} />
              ))
            ) : (
              <Empty text="No tools were invoked." />
            )}
          </Section>
          <Section title="Evaluator results">
            <JsonBlock label="Safety and task evaluation" value={artifact.evaluation} />
          </Section>
          <Section title="Usage and stop reasons">
            <JsonBlock label="Usage" value={artifact.usage} />
            <JsonBlock label="Stop reasons" value={artifact.stopReasons} />
          </Section>
          <Section title="Errors">
            {artifact.errors.length > 0 ? (
              <JsonBlock label="Structured run errors" value={artifact.errors} />
            ) : (
              <Empty text="No structured errors were recorded." />
            )}
          </Section>
          <Section title="Initial/final virtual filesystem diff">
            {artifact.files.diff.length > 0 ? (
              artifact.files.diff.map((change) => (
                <JsonBlock key={change.path} label={`${change.kind} · ${change.path}`} value={change} />
              ))
            ) : (
              <Empty text="The virtual filesystem did not change." />
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-serif text-2xl font-medium">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 font-mono text-xs leading-5">
        {text}
      </pre>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: JsonValue | unknown }) {
  return <TextBlock label={label} text={JSON.stringify(value, null, 2)} />;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted">{text}</p>;
}

function Verdict({ passed, status }: { passed: boolean; status?: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
      passed
        ? "border-[rgba(78,201,122,0.35)] bg-[rgba(78,201,122,0.16)] text-success"
        : "border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.16)] text-danger"
    }`}>
      {status ?? (passed ? "passed" : "failed")}
    </span>
  );
}
