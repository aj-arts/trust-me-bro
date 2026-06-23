"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Scenario } from "@/scenarios/types";

type RunnerViewProps = {
  scenario: Scenario;
};

export function RunnerView({ scenario }: RunnerViewProps) {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4.1-mini");

  const fileEntries = useMemo(() => Object.entries(scenario.files), [scenario.files]);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
      <aside className="flex flex-col gap-5">
        <Link href="/" className="font-mono text-sm text-muted hover:text-foreground">
          Back to dashboard
        </Link>

        <section className="rounded-lg border border-border bg-panel p-5">
          <p className="font-mono text-xs uppercase text-muted">{scenario.id}</p>
          <h1 className="mt-2 text-2xl font-semibold">{scenario.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{scenario.description}</p>
        </section>

        <section className="rounded-lg border border-border bg-panel p-5">
          <h2 className="text-base font-semibold">Run setup</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="openrouter-key">
            OpenRouter key
          </label>
          <input
            id="openrouter-key"
            value={openRouterKey}
            onChange={(event) => setOpenRouterKey(event.target.value)}
            type="password"
            placeholder="sk-or-..."
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-accent"
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          >
            <option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option>
            <option value="anthropic/claude-sonnet-4">anthropic/claude-sonnet-4</option>
            <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
          </select>

          <button
            type="button"
            disabled={!openRouterKey.trim()}
            className="mt-5 h-10 w-full rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start run
          </button>
        </section>

        <section className="rounded-lg border border-border bg-panel p-5">
          <h2 className="text-base font-semibold">Canaries</h2>
          <div className="mt-4 flex flex-col gap-3">
            {scenario.canaries.map((canary) => (
              <div key={canary.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{canary.label}</p>
                <p className="mt-1 font-mono text-xs text-muted">{canary.kind}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="grid gap-6">
        <div className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Agent trace</h2>
            <p className="mt-1 text-sm text-muted">
              Live Pi and just-bash events will stream here.
            </p>
          </div>
          <div className="px-5 py-8 font-mono text-sm text-muted">Runner not started.</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Virtual filesystem</h2>
            </div>
            <div className="divide-y divide-border">
              {fileEntries.map(([path, contents]) => (
                <details key={path} className="group">
                  <summary className="cursor-pointer px-5 py-3 font-mono text-sm">
                    {path}
                  </summary>
                  <pre className="max-h-72 overflow-auto bg-background px-5 py-4 text-xs leading-5 text-muted">
                    {contents}
                  </pre>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Command log</h2>
            </div>
            <div className="px-5 py-8 font-mono text-sm text-muted">
              just-bash command output will appear here.
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
