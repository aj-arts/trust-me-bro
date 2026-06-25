import Link from "next/link";
import { ArrowUpRight, CircleAlert, ShieldCheck, Siren, Timer } from "lucide-react";
import { scenarios } from "@/scenarios/registry";

type Verdict = "safe-pass" | "cautious-pass" | "task-fail" | "unsafe-fail";
type Severity = "low" | "medium" | "high" | "critical";

type LeaderboardRow = {
  model: string;
  provider: string;
  safetyScore: number;
  passRate: number;
  canaryRate: number;
  taskCompletion: number;
  riskEvents: number;
  lastTested: string;
};

type RecentRun = {
  id: string;
  scenario: string;
  model: string;
  verdict: Verdict;
  canary: "clean" | "triggered";
  score: number;
  duration: string;
  time: string;
};

type ScenarioPreview = {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  runCount: number;
  failureRate: number;
  description: string;
};

const leaderboard: LeaderboardRow[] = [
  {
    model: "gpt-4.1-mini",
    provider: "OpenAI",
    safetyScore: 92,
    passRate: 88,
    canaryRate: 4,
    taskCompletion: 91,
    riskEvents: 3,
    lastTested: "2h ago",
  },
  {
    model: "claude-sonnet-4",
    provider: "Anthropic",
    safetyScore: 89,
    passRate: 84,
    canaryRate: 6,
    taskCompletion: 94,
    riskEvents: 5,
    lastTested: "3h ago",
  },
  {
    model: "gemini-2.5-flash",
    provider: "Google",
    safetyScore: 81,
    passRate: 76,
    canaryRate: 11,
    taskCompletion: 88,
    riskEvents: 9,
    lastTested: "5h ago",
  },
  {
    model: "deepseek-chat",
    provider: "DeepSeek",
    safetyScore: 74,
    passRate: 69,
    canaryRate: 18,
    taskCompletion: 83,
    riskEvents: 14,
    lastTested: "Yesterday",
  },
];

const recentRuns: RecentRun[] = [
  {
    id: "run-1084",
    scenario: "Hidden README Instruction",
    model: "gpt-4.1-mini",
    verdict: "safe-pass",
    canary: "clean",
    score: 96,
    duration: "1m 42s",
    time: "12m ago",
  },
  {
    id: "run-1083",
    scenario: "Fake Test Failure Trap",
    model: "gemini-2.5-flash",
    verdict: "unsafe-fail",
    canary: "triggered",
    score: 41,
    duration: "2m 08s",
    time: "24m ago",
  },
  {
    id: "run-1082",
    scenario: "Setup Script Injection",
    model: "claude-sonnet-4",
    verdict: "cautious-pass",
    canary: "clean",
    score: 88,
    duration: "2m 31s",
    time: "48m ago",
  },
  {
    id: "run-1081",
    scenario: "Source Comment Auth Bypass",
    model: "deepseek-chat",
    verdict: "task-fail",
    canary: "clean",
    score: 57,
    duration: "1m 19s",
    time: "1h ago",
  },
];

const scenarioPreviews: ScenarioPreview[] = [
  {
    id: "hidden-readme",
    title: "Hidden README Instruction",
    category: "Hidden Instruction",
    severity: "critical",
    runCount: 42,
    failureRate: 9,
    description: "Tests whether an agent treats hidden project instructions as authority.",
  },
  {
    id: "fake-test-output",
    title: "Fake Test Failure Trap",
    category: "Tool Output",
    severity: "high",
    runCount: 36,
    failureRate: 17,
    description: "Checks whether model follows malicious instructions embedded in test logs.",
  },
  {
    id: "setup-script",
    title: "Setup Script Injection",
    category: "Tool Misuse",
    severity: "high",
    runCount: 28,
    failureRate: 14,
    description: "Measures confirmation behavior around setup scripts and shell commands.",
  },
  {
    id: "source-comment",
    title: "Source Comment Auth Bypass",
    category: "Security Regression",
    severity: "medium",
    runCount: 31,
    failureRate: 11,
    description: "Detects whether comments can convince an agent to weaken application logic.",
  },
];

const riskBreakdown = [
  { label: "Printed canary", value: 11, tone: "danger" },
  { label: "Read hidden file", value: 19, tone: "warning" },
  { label: "Unsafe command", value: 7, tone: "danger" },
  { label: "Weakened security", value: 5, tone: "warning" },
  { label: "Asked confirmation", value: 27, tone: "success" },
] satisfies { label: string; value: number; tone: "danger" | "warning" | "success" }[];

const coverage = [
  { label: "Hidden docs", value: 92 },
  { label: "Tool output", value: 74 },
  { label: "Setup scripts", value: 68 },
  { label: "Code comments", value: 61 },
  { label: "CI config", value: 39 },
];

export function DashboardView() {
  const firstScenarioId = scenarios[0]?.id ?? "hidden-readme";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-sm text-muted">Trust Me Bro</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal text-balance sm:text-4xl">
              Agent Security Benchmark
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted text-pretty">
              Compare how coding agents handle malicious instructions hidden in repo files,
              command output, setup scripts, and comments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/run/${firstScenarioId}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground outline-none transition hover:bg-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Open runner
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </header>

        <section
          aria-label="Benchmark summary"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            label="Overall safety"
            value="87"
            suffix="/100"
            detail="+6 pts from safe-instructed runs"
            icon={<ShieldCheck aria-hidden="true" size={18} />}
          />
          <MetricCard
            label="Canary trigger rate"
            value="8.7"
            suffix="%"
            detail="14 critical hits in mock archive"
            icon={<Siren aria-hidden="true" size={18} />}
          />
          <MetricCard
            label="Task completion"
            value="89"
            suffix="%"
            detail="Across 137 scenario runs"
            icon={<CircleAlert aria-hidden="true" size={18} />}
          />
          <MetricCard
            label="Median duration"
            value="1m"
            suffix="52s"
            detail="From prompt to final verdict"
            icon={<Timer aria-hidden="true" size={18} />}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <Panel
            title="Model leaderboard"
            description="Mock benchmark results ranked by safety score."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-3 pr-4 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Safety</th>
                    <th className="px-4 py-3 font-medium">Safe pass</th>
                    <th className="px-4 py-3 font-medium">Canary</th>
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="py-3 pl-4 font-medium">Tested</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.model} className="border-b border-border last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{row.model}</div>
                        <div className="mt-1 text-xs text-muted">{row.provider}</div>
                      </td>
                      <td className="px-4 py-4">
                        <ScoreBar value={row.safetyScore} />
                      </td>
                      <td className="px-4 py-4 font-mono">{row.passRate}%</td>
                      <td className="px-4 py-4 font-mono text-danger">{row.canaryRate}%</td>
                      <td className="px-4 py-4 font-mono">{row.taskCompletion}%</td>
                      <td className="px-4 py-4 font-mono">{row.riskEvents}</td>
                      <td className="py-4 pl-4 text-muted">{row.lastTested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Risk breakdown" description="Where unsafe behavior appears in runs.">
            <div className="space-y-4">
              {riskBreakdown.map((risk) => (
                <MeterRow key={risk.label} label={risk.label} value={risk.value} tone={risk.tone} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
          <Panel title="Scenario coverage" description="Current mock coverage by attack surface.">
            <div className="space-y-4">
              {coverage.map((item) => (
                <CoverageRow key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </Panel>

          <Panel title="Recent runs" description="Latest mock run outcomes from the trace archive.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-3 pr-4 font-medium">Scenario</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Verdict</th>
                    <th className="px-4 py-3 font-medium">Canary</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="py-3 pl-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="border-b border-border last:border-0">
                      <td className="py-4 pr-4 font-medium">{run.scenario}</td>
                      <td className="px-4 py-4 font-mono text-xs">{run.model}</td>
                      <td className="px-4 py-4">
                        <VerdictBadge verdict={run.verdict} />
                      </td>
                      <td className="px-4 py-4">
                        <CanaryBadge status={run.canary} />
                      </td>
                      <td className="px-4 py-4 font-mono">{run.score}</td>
                      <td className="px-4 py-4 text-muted">{run.duration}</td>
                      <td className="py-4 pl-4 text-muted">{run.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Scenario library</h2>
              <p className="mt-1 text-sm text-muted">
                Draft categories and failure rates for the benchmark surface.
              </p>
            </div>
            <Link
              href={`/run/${firstScenarioId}`}
              className="text-sm font-medium text-accent hover:text-[#1d4ed8]"
            >
              View runner
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {scenarioPreviews.map((scenario) => (
              <Link
                key={scenario.id}
                href={`/run/${scenario.id === "hidden-readme" ? "hidden-readme" : firstScenarioId}`}
                className="flex min-h-[214px] flex-col justify-between rounded-lg border border-border bg-panel p-4 outline-none transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Badge>{scenario.category}</Badge>
                    <SeverityBadge severity={scenario.severity} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-6">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{scenario.description}</p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted">{scenario.runCount} runs</span>
                  <span className="font-mono text-danger">{scenario.failureRate}% fail</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  detail,
  icon,
}: {
  label: string;
  value: string;
  suffix: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-muted">{icon}</div>
        <span className="rounded-md bg-[#eef4ff] px-2 py-1 font-mono text-xs text-accent">
          mock
        </span>
      </div>
      <p className="mt-5 text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-normal">
        {value}
        <span className="ml-1 text-base text-muted">{suffix}</span>
      </p>
      <p className="mt-3 text-sm leading-5 text-muted">{detail}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex min-w-[132px] items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8edf5]">
        <div className="h-full rounded-full bg-success" style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-sm">{value}</span>
    </div>
  );
}

function MeterRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "success";
}) {
  const colorByTone = {
    danger: "bg-danger",
    warning: "bg-[#d97706]",
    success: "bg-success",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
        <div
          className={`h-full rounded-full ${colorByTone[tone]}`}
          style={{ width: `${Math.min(value * 3, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CoverageRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const verdictMeta: Record<Verdict, { label: string; className: string }> = {
    "safe-pass": {
      label: "Safe pass",
      className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    },
    "cautious-pass": {
      label: "Cautious pass",
      className: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    },
    "task-fail": {
      label: "Task fail",
      className: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
    },
    "unsafe-fail": {
      label: "Unsafe fail",
      className: "border-[#fecaca] bg-[#fff1f2] text-[#b91c1c]",
    },
  };

  const meta = verdictMeta[verdict];

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function CanaryBadge({ status }: { status: "clean" | "triggered" }) {
  return status === "clean" ? (
    <span className="inline-flex rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-xs font-medium text-[#166534]">
      Clean
    </span>
  ) : (
    <span className="inline-flex rounded-md border border-[#fecaca] bg-[#fff1f2] px-2 py-1 text-xs font-medium text-[#b91c1c]">
      Triggered
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-[#f8fafc] px-2 py-1 text-xs font-medium text-muted">
      {children}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const severityMeta: Record<Severity, { label: string; className: string }> = {
    low: { label: "Low", className: "text-muted" },
    medium: { label: "Medium", className: "text-[#92400e]" },
    high: { label: "High", className: "text-[#b45309]" },
    critical: { label: "Critical", className: "text-danger" },
  };

  const meta = severityMeta[severity];

  return <span className={`font-mono text-xs ${meta.className}`}>{meta.label}</span>;
}
