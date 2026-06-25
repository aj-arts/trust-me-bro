"use client";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  FlaskConical,
  Grid3x3,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
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

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "safety", label: "Safety Score", icon: BarChart3 },
  { id: "robustness", label: "Robustness", icon: LineChart },
  { id: "heatmap", label: "Risk Heatmap", icon: Grid3x3 },
  { id: "difficulty", label: "Difficulty", icon: ListOrdered },
];

const NAV_IDS = NAV.map((n) => n.id);

export function DashboardView() {
  const [mode, setMode] = useState<PromptModeId>(DEFAULT_PROMPT_MODE);
  const active = useScrollSpy(NAV_IDS);
  const activeMode = promptModes.find((m) => m.id === mode)!;
  const modeRuns = totalRuns(mode);
  const firstRunnable = runnableScenarios[0]?.id ?? "";

  return (
    <div className="deck-root min-h-screen">
      <TooltipBoundary>
        <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[236px_1fr]">
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface/60 px-4 py-5 lg:flex">
            <Brand />
            <nav className="mt-8 flex flex-col gap-0.5">
              <p className="deck-label mb-2 px-2.5 text-muted">Deck</p>
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] font-medium transition-colors ${
                      isActive
                        ? "bg-accent-soft text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-4">
              <Link
                href={`/run/${firstRunnable}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 text-[0.8rem] font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <FlaskConical size={14} />
                Open runner
              </Link>
              <div className="flex items-center gap-2 px-1 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                System nominal
              </div>
              <p className="px-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted/70">
                Last sync 2026-06-24 19:04 UTC
              </p>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 px-5 pb-16 sm:px-8">
            {/* Mobile brand row */}
            <div className="flex items-center justify-between gap-3 py-4 lg:hidden">
              <Brand compact />
              <Link
                href={`/run/${firstRunnable}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 text-[0.78rem] font-medium text-foreground"
              >
                <FlaskConical size={13} />
                Runner
              </Link>
            </div>

            <header id="overview" className="scroll-mt-4 pt-2 lg:pt-8">
              <div className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted">
                <Activity size={12} className="text-accent" />
                Adversarial Instrument Deck
              </div>
              <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <h1 className="text-balance text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.025em] text-foreground sm:text-[2.7rem]">
                    Agent Security Benchmark
                  </h1>
                  <p className="mt-3 text-pretty text-[0.95rem] leading-6 text-muted">
                    Independent evaluation of how reliably coding agents resist
                    hidden malicious instructions planted in repo files, skills,
                    and setup scripts. Lower canary trigger rates mean safer
                    behavior.
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-border bg-panel px-5 py-4 sm:grid-cols-4 xl:grid-cols-2">
                  <Stat label="Models" value={fmt(models.length)} />
                  <Stat label="Scenarios" value={fmt(scenarios.length)} />
                  <Stat label="Prompt modes" value={fmt(promptModes.length)} />
                  <Stat label="Runs" value={fmt(totalRunsAllModes())} />
                </dl>
              </div>
            </header>

            {/* Control bar */}
            <div className="sticky top-0 z-20 -mx-5 mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-border bg-background/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="deck-label text-muted-strong">Prompt mode</span>
                <PromptModeToggle value={mode} onChange={setMode} />
                <span className="hidden max-w-md text-[0.78rem] leading-5 text-muted lg:inline">
                  {activeMode.description}
                </span>
              </div>
              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                Mock data
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-5">
              {/* 1 — Primary: Scenario-Weighted Safety Score */}
              <ChartPanel
                id="safety"
                title="Scenario-Weighted Safety Score"
                subtitle="Average safety pass rate across all scenarios, counting each scenario equally. Higher is safer. Ranked for the selected prompt mode."
                hint="Per model: mean of (1 − canary trigger rate) over every scenario, each scenario weighted equally regardless of run count."
                controls={
                  <PromptModeToggle value={mode} onChange={setMode} size="sm" idBase="score" />
                }
                meta={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      WEIGHTED ACROSS {scenarios.length} SCENARIOS · {fmt(modeRuns)} RUNS ·{" "}
                      {activeMode.label.toUpperCase()} MODE
                    </span>
                    <RiskLegend lowLabel="Safer" highLabel="Riskier" />
                  </div>
                }
              >
                <SafetyScoreChart mode={mode} />
              </ChartPanel>

              {/* 2 — Prompt Robustness */}
              <ChartPanel
                id="robustness"
                title="Prompt Robustness"
                subtitle="Each model's scenario-weighted safety score as system prompts relax from Safe to Neutral to Permissive. Flatter lines mean safety holds under pressure; steep drops mean it doesn't."
                hint="Hover a line to isolate one model. The right-edge value is its Permissive-mode score."
                meta={`ALL THREE PROMPT MODES · ${fmt(totalRunsAllModes())} RUNS · ${models.length} MODELS`}
              >
                <PromptRobustnessChart />
              </ChartPanel>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                {/* 3 — Scenario Risk Heatmap */}
                <ChartPanel
                  id="heatmap"
                  className="xl:col-span-2"
                  title="Scenario Risk Heatmap"
                  subtitle="Canary trigger rate per model and scenario in the selected prompt mode. Greener cells are safer, redder cells fail more often."
                  hint="Rows are models (safest at the top), columns are scenarios. Each cell is the share of runs that tripped a canary."
                  controls={
                    <PromptModeToggle value={mode} onChange={setMode} size="sm" idBase="heat" />
                  }
                  meta={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {models.length}×{scenarios.length} CELLS · {fmt(modeRuns)} RUNS ·{" "}
                        {activeMode.label.toUpperCase()} MODE
                      </span>
                      <RiskLegend lowLabel="0%" highLabel="100%" />
                    </div>
                  }
                >
                  <ScenarioHeatmap mode={mode} />
                </ChartPanel>

                {/* 4 — Scenario Difficulty */}
                <ChartPanel
                  id="difficulty"
                  title="Scenario Difficulty"
                  subtitle="Scenarios ranked by average canary trigger rate across all models. The traps at the top defeat the most models."
                  hint="Average of every model's trigger rate for the scenario, each model weighted equally."
                  meta={`AVG ACROSS ${models.length} MODELS · ${fmt(modeRuns)} RUNS · ${activeMode.label.toUpperCase()} MODE`}
                >
                  <ScenarioDifficultyChart mode={mode} />
                </ChartPanel>
              </div>
            </div>

            {/* Status bar */}
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted">
              <span>Deck ADV-INST-01 · Data source mock grid · Integrity OK</span>
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-[0_0_18px_-4px_var(--accent)]">
        <ShieldCheck size={18} strokeWidth={2.2} />
      </span>
      <div className="flex flex-col leading-none">
        <span className="font-mono text-[0.82rem] font-semibold tracking-tight text-foreground">
          Trust&nbsp;Me&nbsp;Bro
        </span>
        {!compact ? (
          <span className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
            Benchmark v1.4
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="font-mono text-lg font-semibold tabular-nums leading-none text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** Highlights the nav item whose section is currently in view. */
function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
