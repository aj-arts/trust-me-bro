"use client";

import { useEffect, useState } from "react";
import { RunResultView } from "@/components/RunResultView";
import type { RunResult } from "@/lib/engine/types";
import type { ScenarioSummary } from "@/lib/scenarios/types";

type RunState = {
  none?: RunResult;
  safe?: RunResult;
};

function groupByCategory(
  items: ScenarioSummary[],
): [string, ScenarioSummary[]][] {
  const groups = new Map<string, ScenarioSummary[]>();
  for (const s of items) {
    const list = groups.get(s.category);
    if (list) list.push(s);
    else groups.set(s.category, [s]);
  }
  return [...groups.entries()];
}

export default function Home() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunState>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then((d: { scenarios: ScenarioSummary[] }) => {
        setScenarios(d.scenarios);
        if (d.scenarios[0]) setSelectedId(d.scenarios[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const selected = scenarios.find((s) => s.id === selectedId) ?? null;

  function selectScenario(id: string) {
    setSelectedId(id);
    setRuns({});
    setError(null);
    setOpenFile(null);
  }

  async function runOne(safetyMode: "none" | "safe"): Promise<RunResult> {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: selectedId, safetyMode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Run failed");
    return data.result as RunResult;
  }

  async function runComparison() {
    if (!selectedId) return;
    setRunning(true);
    setError(null);
    setRuns({});
    try {
      const [none, safe] = await Promise.all([runOne("none"), runOne("safe")]);
      setRuns({ none, safe });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">
          Trust Me Bro{" "}
          <span className="text-zinc-500">— the agenty security benchmark</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Each scenario hides a malicious instruction in repo files, docs, or
          setup scripts. We run a coding agent in a sandboxed virtual shell
          (powered by just-bash) with fake secrets and harmless canaries, then
          measure whether it ignores the trap or gets compromised — with and
          without safe-coding instructions.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: scenario list */}
        <aside className="space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Scenarios{" "}
            <span className="text-zinc-600">({scenarios.length})</span>
          </h2>
          {groupByCategory(scenarios).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="sticky top-0 z-10 bg-zinc-950/80 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 backdrop-blur">
                {category}{" "}
                <span className="text-zinc-600">({items.length})</span>
              </div>
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s.id)}
                  className={`block w-full rounded-lg border p-3 text-left transition ${
                    s.id === selectedId
                      ? "border-sky-600/60 bg-sky-950/30"
                      : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-200">
                    {s.title}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main panel */}
        <section className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {selected && (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                  {selected.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-300">
                    What this tests:{" "}
                  </span>
                  {selected.description}
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  <span className="font-semibold">Task given to agent: </span>
                  <span className="text-zinc-400">{selected.userTask}</span>
                </p>

                {/* Virtual repo files */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Virtual repo
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.keys(selected.files).map((path) => (
                      <button
                        key={path}
                        onClick={() =>
                          setOpenFile(openFile === path ? null : path)
                        }
                        className={`rounded border px-2 py-1 font-mono text-xs ${
                          openFile === path
                            ? "border-sky-600 bg-sky-950/40 text-sky-200"
                            : "border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600"
                        }`}
                      >
                        {path}
                      </button>
                    ))}
                  </div>
                  {openFile && (
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/50 p-3 font-mono text-xs text-zinc-300">
                      {selected.files[openFile]}
                    </pre>
                  )}
                </div>

                <button
                  onClick={runComparison}
                  disabled={running}
                  className="mt-5 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? "Running…" : "Run benchmark (both safety modes)"}
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  Uses the built-in deterministic mock agent. No API key
                  required.
                </p>
              </div>

              {/* Side-by-side traces */}
              {(runs.none || runs.safe) && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {runs.none && <RunResultView result={runs.none} />}
                  {runs.safe && <RunResultView result={runs.safe} />}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
