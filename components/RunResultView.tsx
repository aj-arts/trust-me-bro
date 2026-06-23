"use client";

import type { RunResult } from "@/lib/engine/types";

function Badge({ verdict }: { verdict: RunResult["verdict"] }) {
  const safe = verdict === "safe";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        safe
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
      }`}
    >
      {safe ? "● SAFE" : "● COMPROMISED"}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function RunResultView({ result }: { result: RunResult }) {
  return (
    <div className="space-y-5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-200">
            {result.safetyMode === "safe"
              ? "Safe-coding instructions"
              : "No safety instructions"}
          </div>
          <div className="text-xs text-zinc-500">
            model: {result.modelId} · {result.steps} steps · {result.stoppedReason}
          </div>
        </div>
        <Badge verdict={result.verdict} />
      </div>

      <Section title="Canaries">
        <ul className="space-y-1.5">
          {result.canaries.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-md bg-zinc-950/40 p-2 text-sm"
            >
              <span
                className={`mt-0.5 text-xs font-bold ${
                  c.triggered ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {c.triggered ? "TRIGGERED" : "ok"}
              </span>
              <span>
                <span className="font-medium text-zinc-200">{c.label}</span>
                <span className="block text-xs text-zinc-500">
                  {c.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Agent trace (${result.turns.length} commands)`}>
        <ol className="space-y-2">
          {result.turns.map((t) => (
            <li
              key={t.step}
              className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2.5"
            >
              <p className="mb-1.5 text-xs italic text-zinc-400">
                {t.reasoning}
              </p>
              <code className="block whitespace-pre-wrap break-all rounded bg-black/50 px-2 py-1 font-mono text-xs text-sky-300">
                $ {t.command}
              </code>
              {(t.stdout || t.stderr) && (
                <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-400">
                  {t.stdout}
                  {t.stderr ? `\n[stderr] ${t.stderr}` : ""}
                </pre>
              )}
              <div className="mt-1 text-[10px] text-zinc-600">
                exit code: {t.exitCode}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {result.fetches.length > 0 && (
        <Section title="Network attempts (captured, not sent)">
          <ul className="space-y-1.5">
            {result.fetches.map((f, i) => (
              <li
                key={i}
                className="rounded-md border border-red-900/40 bg-red-950/20 p-2 font-mono text-xs text-red-300"
              >
                <div>
                  {f.method} {f.url}
                </div>
                {f.body && (
                  <div className="mt-1 break-all text-red-400/80">
                    body: {f.body}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Filesystem changes">
        {result.fsChanges.length === 0 ? (
          <p className="text-xs text-zinc-500">No files changed.</p>
        ) : (
          <ul className="space-y-1">
            {result.fsChanges.map((c) => (
              <li key={c.path} className="font-mono text-xs">
                <span
                  className={
                    c.kind === "added"
                      ? "text-emerald-400"
                      : c.kind === "deleted"
                        ? "text-red-400"
                        : "text-amber-400"
                  }
                >
                  {c.kind.padEnd(8)}
                </span>
                <span className="text-zinc-300">{c.path}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Agent's final message">
        <p className="rounded-md bg-zinc-950/50 p-2.5 text-sm text-zinc-300">
          {result.finalMessage}
        </p>
      </Section>
    </div>
  );
}
