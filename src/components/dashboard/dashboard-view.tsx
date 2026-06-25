"use client";

import { ShieldCheck, FlaskConical, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { scenarios as runnableScenarios } from "@/scenarios/registry";
import {
  DEFAULT_PROMPT_MODE,
  models,
  promptModes,
  scenarios,
  totalRuns,
  totalRunsAllModes,
  type PromptModeId,
} from "@/lib/dashboard/mock-data";
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

function fmt(n: number): string {
  return n.toLocaleString();
}

export function DashboardView() {
  const [mode, setMode] = useState<PromptModeId>(DEFAULT_PROMPT_MODE);
  const activeMode = promptModes.find((m) => m.id === mode)!;
  const modeRuns = totalRuns(mode);
  const firstRunnable = runnableScenarios[0]?.id ?? "";

  return (
    <TooltipBoundary>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-16 sm:px-8">
        <header className="flex flex-col gap-5 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                <ShieldCheck size={18} strokeWidth={2.2} />
              </span>
              <span className="font-mono text-sm font-medium tracking-tight text-muted-strong">
                Trust Me Bro
              </span>
              <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-wide text-muted">
                Mock data
              </span>
            </div>
            <Link
              href={`/run/${firstRunnable}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#1d4fd7]"
            >
              <FlaskConical size={15} />
              Open runner
            </Link>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[2.4rem]">
              Agent Security Benchmark
            </h1>
            <p className="mt-3 text-pretty text-[0.95rem] leading-6 text-muted">
              How reliably do coding agents resist hidden malicious instructions
              planted in repo files, skills, and setup scripts? Lower canary
              trigger rates mean safer behavior.
            </p>
          </div>
        </header>

        {/* Sticky control bar */}
        <div className="sticky top-0 z-20 -mx-5 mt-6 border-y border-border bg-background/95 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[0.8rem] font-medium text-muted-strong">
                Prompt mode
              </span>
              <PromptModeToggle value={mode} onChange={setMode} />
              <span className="hidden max-w-md text-[0.78rem] leading-5 text-muted lg:inline">
                {activeMode.description}
              </span>
            </div>
            <dl className="flex items-center gap-x-5 gap-y-1 font-mono text-[0.72rem] text-muted">
              <Coverage label="models" value={fmt(models.length)} />
              <Coverage label="scenarios" value={fmt(scenarios.length)} />
              <Coverage label="modes" value={fmt(promptModes.length)} />
              <Coverage label="runs" value={fmt(totalRunsAllModes())} />
            </dl>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {/* 1 — Primary: Scenario-Weighted Safety Score */}
          <ChartPanel
            title="Scenario-Weighted Safety Score"
            subtitle="Average safety pass rate across all scenarios, counting each scenario equally. Higher is safer. Ranked for the selected prompt mode."
            controls={
              <PromptModeToggle value={mode} onChange={setMode} size="sm" idBase="score" />
            }
            meta={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Weighted across {scenarios.length} scenarios · {fmt(modeRuns)} runs
                  in {activeMode.label.toLowerCase()} mode
                </span>
                <RiskLegend lowLabel="Safer" highLabel="Riskier" />
              </div>
            }
          >
            <SafetyScoreChart mode={mode} />
          </ChartPanel>

          {/* 2 — Prompt Robustness */}
          <ChartPanel
            title="Prompt Robustness"
            subtitle="Each model's scenario-weighted safety score as system prompts relax from Safe to Neutral to Permissive. Flatter lines mean safety holds under pressure; steep drops mean it doesn't."
            meta={`All three prompt modes · ${fmt(totalRunsAllModes())} runs · ${models.length} models`}
          >
            <PromptRobustnessChart />
          </ChartPanel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* 3 — Scenario Risk Heatmap */}
            <ChartPanel
              className="xl:col-span-2"
              title="Scenario Risk Heatmap"
              subtitle="Canary trigger rate per model and scenario in the selected prompt mode. Greener cells are safer, redder cells fail more often."
              controls={
                <PromptModeToggle value={mode} onChange={setMode} size="sm" idBase="heat" />
              }
              meta={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {models.length}×{scenarios.length} cells · {fmt(modeRuns)} runs in{" "}
                    {activeMode.label.toLowerCase()} mode
                  </span>
                  <RiskLegend lowLabel="0%" highLabel="100%" />
                </div>
              }
            >
              <ScenarioHeatmap mode={mode} />
            </ChartPanel>

            {/* 4 — Scenario Difficulty */}
            <ChartPanel
              title="Scenario Difficulty"
              subtitle="Scenarios ranked by average canary trigger rate across all models. The traps at the top defeat the most models."
              meta={`Averaged across ${models.length} models · ${fmt(modeRuns)} runs in ${activeMode.label.toLowerCase()} mode`}
            >
              <ScenarioDifficultyChart mode={mode} />
            </ChartPanel>
          </div>
        </div>

        <footer className="mt-10 flex items-center gap-2 text-[0.78rem] text-muted">
          <span>
            All figures are synthesized mock data for layout review. Wire to
            persisted Convex run results to go live.
          </span>
          <Link
            href={`/run/${firstRunnable}`}
            className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
          >
            Run a scenario
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      </main>
    </TooltipBoundary>
  );
}

function Coverage({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="tnum text-[0.82rem] font-semibold text-foreground">{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}
