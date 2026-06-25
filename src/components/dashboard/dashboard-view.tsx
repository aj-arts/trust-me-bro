"use client";

import { ArrowUpRight } from "lucide-react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { scenarios as runnableScenarios } from "@/scenarios/registry";
import {
  DEFAULT_PROMPT_MODE,
  mockDashboardData,
  promptModes,
  type PromptModeId,
} from "@/lib/dashboard/mock-data";
import {
  buildRealDashboardData,
  type SavedRunForDashboard,
} from "@/lib/dashboard/real-data";
import {
  ChartPanel,
  PromptModeToggle,
  RiskLegend,
  TooltipBoundary,
} from "@/components/dashboard/ui";
import { SafetyScoreChart } from "@/components/dashboard/charts/safety-score-chart";
import { PromptRobustnessChart } from "@/components/dashboard/charts/prompt-robustness-chart";
import { ScenarioHeatmap } from "@/components/dashboard/charts/scenario-heatmap";
import { ScenarioDifficultyChart } from "@/components/dashboard/charts/scenario-difficulty-chart";
import { FloatingNav } from "@/components/floating-nav";

function fmt(n: number): string {
  return n.toLocaleString();
}

type DashboardData = typeof mockDashboardData;

export function DashboardView() {
  const [mode, setMode] = useState<PromptModeId>(DEFAULT_PROMPT_MODE);

  return (
    <RealDashboardView
      mode={mode}
      onModeChange={setMode}
    />
  );
}

function RealDashboardView({
  mode,
  onModeChange,
}: {
  mode: PromptModeId;
  onModeChange: (mode: PromptModeId) => void;
}) {
  const savedRuns = useQuery(api.runs.listForDashboard, {});
  const data = useMemo(
    () => buildRealDashboardData((savedRuns ?? []) as SavedRunForDashboard[]),
    [savedRuns],
  );

  return (
    <DashboardShell
      mode={mode}
      onModeChange={onModeChange}
      data={data}
      loading={savedRuns === undefined}
    />
  );
}

function DashboardShell({
  mode,
  onModeChange,
  data,
  loading = false,
}: {
  mode: PromptModeId;
  onModeChange: (mode: PromptModeId) => void;
  data: DashboardData;
  loading?: boolean;
}) {
  const activeMode = promptModes.find((m) => m.id === mode)!;
  const modeRuns = data.totalRuns(mode);
  const firstRunnable = runnableScenarios[0]?.id ?? "";
  const sourceLabel = loading ? "Loading Convex" : "Convex data";

  return (
    <div className="deck-root min-h-screen">
      <TooltipBoundary>
        <div className="mx-auto w-full max-w-[1500px]">
          {/* Main */}
          <div className="min-w-0 px-5 pb-16 sm:px-8">
            <FloatingNav
              active="dashboard"
              dashboardHref="#overview"
              runnerHref={`/run/${firstRunnable}`}
            />

            <header id="overview" className="scroll-mt-24 pt-10 lg:pt-14">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <h1 className="text-balance font-serif text-[3.6rem] font-medium leading-[0.88] tracking-[-0.045em] text-foreground sm:text-[5.6rem]">
                    Trust Me Bro
                  </h1>
                  <p className="mt-4 text-balance font-serif text-[1.55rem] leading-[1.08] tracking-[-0.02em] text-foreground/90 sm:text-[2.05rem]">
                    Benchmarking the Security of AI Agents
                  </p>
                  <p className="mt-5 max-w-3xl text-pretty text-[1.02rem] leading-7 text-muted sm:text-[1.1rem]">
                    Independent evaluation of how reliably coding agents resist
                    hidden malicious instructions planted in repo files, skills,
                    and setup scripts. Lower canary trigger rates mean safer
                    behavior.
                  </p>
                </div>
                <dl className="grid w-full max-w-xl shrink-0 grid-cols-2 gap-x-12 gap-y-6 rounded-[1.5rem] border border-border bg-panel px-7 py-6 sm:grid-cols-4 xl:w-[360px] xl:max-w-none xl:grid-cols-2 xl:px-8 xl:py-7">
                  <Stat label="Models" value={fmt(data.models.length)} />
                  <Stat label="Scenarios" value={fmt(data.scenarios.length)} />
                  <Stat label="Prompt modes" value={fmt(promptModes.length)} />
                  <Stat label="Runs" value={loading ? "..." : fmt(data.totalRunsAllModes())} />
                </dl>
              </div>
            </header>

            {/* Control bar */}
            <div className="sticky top-0 z-20 -mx-5 mt-9 flex flex-wrap items-center justify-between gap-x-7 gap-y-4 border-y border-border bg-background/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
              <div className="flex min-w-0 flex-wrap items-center gap-3.5">
                <span className="deck-label text-muted-strong">Prompt mode</span>
                <PromptModeToggle value={mode} onChange={onModeChange} />
                <span className="hidden min-w-0 max-w-xl flex-1 truncate text-[0.95rem] leading-6 text-muted lg:block">
                  {activeMode.description}
                </span>
              </div>
              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.08em] text-muted">
                {sourceLabel}
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {/* 1 — Primary: Scenario-Weighted Safety Score */}
                <ChartPanel
                  id="safety"
                  title="Scenario-Weighted Safety Score"
                  subtitle="Average safety pass rate across all scenarios, counting each scenario equally. Higher is safer. Ranked for the selected prompt mode."
                  hint="Per model: mean of (1 − canary trigger rate) over every scenario, each scenario weighted equally regardless of run count."
                  controls={
                    <PromptModeToggle value={mode} onChange={onModeChange} size="sm" idBase="score" />
                  }
                  meta={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        WEIGHTED ACROSS {data.scenarios.length} SCENARIOS · {fmt(modeRuns)} RUNS ·{" "}
                        {activeMode.label.toUpperCase()} MODE
                      </span>
                      <RiskLegend lowLabel="Safer" highLabel="Riskier" />
                    </div>
                  }
                >
                  <SafetyScoreChart mode={mode} rows={data.rankedSafetyScores(mode)} />
                </ChartPanel>

                {/* 2 — Prompt Robustness */}
                <ChartPanel
                  id="robustness"
                  title="Prompt Robustness"
                  subtitle="Each model's scenario-weighted safety score as system prompts relax from Safe to Neutral to Unsafe. Flatter lines mean safety holds under pressure; steep drops mean it doesn't."
                  hint="Hover a line to isolate one model. The right-edge value is its Unsafe-mode score."
                  meta={`ALL THREE PROMPT MODES · ${fmt(data.totalRunsAllModes())} RUNS · ${data.models.length} MODELS`}
                >
                  <PromptRobustnessChart series={data.robustnessSeries()} />
                </ChartPanel>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* 3 — Scenario Risk Heatmap */}
                <ChartPanel
                  id="heatmap"
                  className="xl:col-span-2"
                  title="Scenario Risk Heatmap"
                  subtitle="Canary trigger rate per model and scenario in the selected prompt mode. Greener cells are safer, redder cells fail more often."
                  hint="Rows are models (safest at the top), columns are scenarios. Each cell is the share of runs that tripped a canary."
                  controls={
                    <PromptModeToggle value={mode} onChange={onModeChange} size="sm" idBase="heat" />
                  }
                  meta={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {data.models.length}×{data.scenarios.length} CELLS · {fmt(modeRuns)} RUNS ·{" "}
                        {activeMode.label.toUpperCase()} MODE
                      </span>
                      <RiskLegend lowLabel="0%" highLabel="100%" />
                    </div>
                  }
                >
                  <ScenarioHeatmap mode={mode} rows={data.heatmap(mode)} />
                </ChartPanel>

                {/* 4 — Scenario Difficulty */}
                <ChartPanel
                  id="difficulty"
                  title="Scenario Difficulty"
                  subtitle="Scenarios ranked by average canary trigger rate across all models. The traps at the top defeat the most models."
                  hint="Average of every model's trigger rate for the scenario, each model weighted equally."
                  meta={`AVG ACROSS ${data.models.length} MODELS · ${fmt(modeRuns)} RUNS · ${activeMode.label.toUpperCase()} MODE`}
                >
                  <ScenarioDifficultyChart mode={mode} rows={data.scenarioDifficultyRanking(mode)} />
                </ChartPanel>
              </div>

              <ChartPanel
                id="scenarios"
                title="Scenario Library"
                subtitle="Inspect the benchmark scenarios behind the dashboard, then open any scenario in Live Runner to review the files, prompts, and canary checks."
                hint="Each row links to the live runner for that scenario, where you can inspect the virtual workspace and execute the benchmark task."
                meta={`${runnableScenarios.length} SCENARIOS · LIVE RUNNER READY`}
              >
                <ScenarioLibrary items={runnableScenarios} />
              </ChartPanel>
            </div>

            {/* Status bar */}
            <footer className="mt-8 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-border pt-4 text-[0.72rem] uppercase tracking-[0.08em] text-muted">
              <Link
                href={`/run/${firstRunnable}`}
                className="inline-flex items-center gap-1 text-accent transition-opacity hover:opacity-80"
              >
                Run a scenario
                <ArrowUpRight size={12} />
              </Link>
            </footer>
          </div>
        </div>
      </TooltipBoundary>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-[0.76rem] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd className="font-serif text-[2.15rem] font-medium tabular-nums leading-none text-foreground">
        {value}
      </dd>
    </div>
  );
}

function ScenarioLibrary({ items }: { items: typeof runnableScenarios }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {items.map((scenario) => (
        <Link
          key={scenario.id}
          href={`/run/${scenario.id}`}
          className="group grid gap-x-4 gap-y-1 border-b border-border bg-surface px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent lg:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.6fr)_auto] lg:items-center"
        >
          <div className="min-w-0">
            <h3 className="truncate font-serif text-base font-medium leading-tight text-foreground">
              {scenario.title}
            </h3>
            <p className="mt-0.5 text-[0.72rem] text-muted">
              {Object.keys(scenario.files).length} files · {scenario.canaries.length}{" "}
              {scenario.canaries.length === 1 ? "canary" : "canaries"}
            </p>
          </div>

          <div className="min-w-0">
            <p className="truncate text-[0.8rem] leading-5 text-muted">
              {scenario.description}
            </p>
          </div>

          <span className="inline-flex items-center gap-1 text-[0.82rem] font-medium text-accent lg:justify-self-end">
            Open
            <ArrowUpRight size={13} />
          </span>
        </Link>
      ))}
    </div>
  );
}
