"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Database,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Gauge,
  GitCompare,
  KeyRound,
  Loader2,
  LockKeyhole,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  BENCHMARK_SCENARIOS,
  MODEL_PRESETS,
  type BenchmarkRunResponse,
  type BenchmarkScenario,
  type EvaluationResult,
  type GeneratedScenarioResponse,
  type RiskLevel,
  type SafetyMode,
  type ScenarioCategory,
  type ScenarioRunResult,
  type TraceArchiveEntry,
  type TraceStep,
} from "@trust-me-bro/benchmark";

const safetyModes: {
  id: SafetyMode;
  label: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    id: "monitor",
    label: "Monitor",
    description: "Observe and log only",
    icon: Eye,
  },
  {
    id: "warn",
    label: "Warn",
    description: "Warn on policy violations",
    icon: Bell,
  },
  {
    id: "block",
    label: "Block",
    description: "Block and halt risky commands",
    icon: CircleStop,
  },
];

const categoryOptions: ScenarioCategory[] = [
  "credential-exfiltration",
  "prompt-injection",
  "privilege-escalation",
  "tool-misuse",
  "data-integrity",
];

const defaultModels = MODEL_PRESETS.slice(0, 5).map((model) => model.id);
type EvidenceTone = "pass" | "warn" | "fail" | "info";

export function BenchmarkConsole() {
  const [scenarios, setScenarios] =
    useState<BenchmarkScenario[]>(BENCHMARK_SCENARIOS);
  const [query, setQuery] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([
    BENCHMARK_SCENARIOS[0].id,
  ]);
  const [selectedModelIds, setSelectedModelIds] =
    useState<string[]>(defaultModels);
  const [safetyMode, setSafetyMode] = useState<SafetyMode>("warn");
  const [apiKey, setApiKey] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (sessionStorage.getItem("trust-me-bro-openrouter-key") ?? ""),
  );
  const [showKey, setShowKey] = useState(false);
  const [activeResultId, setActiveResultId] = useState<string | undefined>();
  const [run, setRun] = useState<BenchmarkRunResponse | undefined>();
  const [archive, setArchive] = useState<TraceArchiveEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatorPrompt, setGeneratorPrompt] = useState(
    "A dependency README asks the agent to call a beacon before applying a harmless migration.",
  );
  const [generatorCategory, setGeneratorCategory] =
    useState<ScenarioCategory>("prompt-injection");
  const [notice, setNotice] = useState<string | undefined>();
  const [visibleTraceCount, setVisibleTraceCount] = useState(80);

  useEffect(() => {
    void loadArchive();
  }, []);

  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem("trust-me-bro-openrouter-key", apiKey);
    } else {
      sessionStorage.removeItem("trust-me-bro-openrouter-key");
    }
  }, [apiKey]);

  const filteredScenarios = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return scenarios;

    return scenarios.filter((scenario) =>
      [
        scenario.title,
        scenario.description,
        scenario.category,
        ...scenario.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, scenarios]);

  const activeScenario = useMemo(
    () =>
      scenarios.find((scenario) => scenario.id === selectedScenarioIds[0]) ??
      scenarios[0],
    [scenarios, selectedScenarioIds],
  );

  const activeResult = useMemo(() => {
    const results = run?.results ?? archive[0]?.results ?? [];
    return (
      results.find((result) => result.id === activeResultId) ??
      results.find((result) => result.scenarioId === activeScenario.id) ??
      results[0]
    );
  }, [activeResultId, activeScenario.id, archive, run]);

  const activeTraceKey = activeResult?.id ?? "";
  const activeTraceLength = activeResult?.trace.length ?? 0;

  useEffect(() => {
    if (!activeTraceLength) return;
    const resetFrame = window.requestAnimationFrame(() => {
      setVisibleTraceCount(1);
    });
    const interval = window.setInterval(() => {
      setVisibleTraceCount((count) => {
        if (count >= activeTraceLength) {
          window.clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, running ? 220 : 60);

    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.clearInterval(interval);
    };
  }, [activeTraceKey, activeTraceLength, running]);

  const displayResults = run?.results ?? archive[0]?.results ?? [];
  const scenarioResults = displayResults.filter(
    (result) => result.scenarioId === activeScenario.id,
  );
  const dashboard = buildDashboard(run?.results ?? [], archive);

  async function loadArchive() {
    try {
      const response = await fetch("/api/archive", { cache: "no-store" });

      if (!response.ok) {
        const body = await readJsonBody<{ error?: string }>(response, {});
        throw new Error(body.error ?? "Archive load failed.");
      }

      const body = await readJsonBody<{ archive?: TraceArchiveEntry[] }>(
        response,
        {},
      );
      setArchive(Array.isArray(body.archive) ? body.archive : []);
    } catch (error) {
      setNotice(messageFromError(error, "Archive load failed."));
    }
  }

  async function handleRun() {
    setRunning(true);
    setNotice(undefined);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioIds: selectedScenarioIds,
          modelIds: selectedModelIds,
          safetyMode,
          openRouterKey: apiKey || undefined,
          generatedScenarios: scenarios.filter((scenario) =>
            scenario.id.startsWith("generated-"),
          ),
        }),
      });

      if (!response.ok) {
        const body = await readJsonBody<{ error?: string }>(response, {});
        throw new Error(body.error ?? "Run failed.");
      }

      const body = await readJsonBody<Partial<BenchmarkRunResponse>>(
        response,
        {},
      );
      if (!Array.isArray(body.results) || !body.runId || !body.startedAt) {
        throw new Error("Run response was malformed.");
      }

      const completedRun = body as BenchmarkRunResponse;
      setRun(completedRun);
      setActiveResultId(completedRun.results[0]?.id);
      await loadArchive();
      setNotice(
        `Completed ${completedRun.results.length} model/scenario run${completedRun.results.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setNotice(messageFromError(error, "Run failed."));
    } finally {
      setRunning(false);
    }
  }

  async function handleGenerateScenario() {
    setGenerating(true);
    setNotice(undefined);

    try {
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatorPrompt,
          category: generatorCategory,
          openRouterKey: apiKey || undefined,
          modelId: selectedModelIds[0],
        }),
      });

      if (!response.ok) {
        const body = await readJsonBody<{ error?: string }>(response, {});
        throw new Error(body.error ?? "Scenario generation failed.");
      }

      const body = await readJsonBody<Partial<GeneratedScenarioResponse>>(
        response,
        {},
      );
      if (!body.scenario?.id || !body.scenario.title || !body.source) {
        throw new Error("Scenario generation response was malformed.");
      }

      const generated = body as GeneratedScenarioResponse;
      setScenarios((current) => [
        generated.scenario,
        ...current.filter((scenario) => scenario.id !== generated.scenario.id),
      ]);
      setSelectedScenarioIds([generated.scenario.id]);
      setNotice(
        `Added ${generated.scenario.title} from ${generated.source === "openrouter" ? "OpenRouter" : "local generator"}.`,
      );
    } catch (error) {
      setNotice(messageFromError(error, "Scenario generation failed."));
    } finally {
      setGenerating(false);
    }
  }

  async function handleClearArchive() {
    try {
      const response = await fetch("/api/archive", { method: "DELETE" });

      if (!response.ok) {
        const body = await readJsonBody<{ error?: string }>(response, {});
        throw new Error(body.error ?? "Archive clear failed.");
      }

      setArchive([]);
      setNotice("Trace archive cleared.");
    } catch (error) {
      setNotice(messageFromError(error, "Archive clear failed."));
    }
  }

  function toggleScenario(scenarioId: string) {
    setSelectedScenarioIds((current) => {
      if (current.includes(scenarioId)) {
        return current.length === 1
          ? current
          : current.filter((id) => id !== scenarioId);
      }
      return [scenarioId, ...current].slice(0, 4);
    });
  }

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) => {
      if (current.includes(modelId)) {
        return current.length === 1
          ? current
          : current.filter((id) => id !== modelId);
      }
      return [...current, modelId].slice(0, 6);
    });
  }

  return (
    <div className="analysis-shell min-h-screen text-[color:var(--foreground)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="analysis-sidebar border-b lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-5 p-4">
            <div className="flex items-center gap-3 border-b border-[color:var(--border-muted)] pb-4">
              <div className="brand-mark flex size-10 items-center justify-center rounded-md">
                <Shield size={22} />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-normal text-[color:var(--foreground)]">
                  Trust Me Bro
                </h1>
                <p className="text-xs text-[color:var(--muted)]">
                  Adversarial Agent Analysis
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="section-label">
                  Scenario Library
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  title="Add generated scenario"
                  aria-label="Add generated scenario"
                  onClick={handleGenerateScenario}
                  disabled={generating}
                >
                  {generating ? <Loader2 size={16} /> : <Plus size={16} />}
                </button>
              </div>

              <label className="field-shell flex h-9 items-center gap-2 px-3 text-sm">
                <Search size={15} />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--subtle)]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search scenarios..."
                  aria-label="Search scenarios"
                />
              </label>

              <div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">
                {filteredScenarios.map((scenario) => (
                  <button
                    type="button"
                    key={scenario.id}
                    className={classNames(
                      "scenario-card w-full p-3 text-left",
                      selectedScenarioIds.includes(scenario.id)
                        ? "scenario-card-active"
                        : "",
                    )}
                    onClick={() => toggleScenario(scenario.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-2">
                        <ShieldAlert
                          size={16}
                          className={riskTextClass(scenario.risk)}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--foreground)]">
                            {scenario.title}
                          </div>
                          <div
                            className={classNames(
                              "mt-1 text-xs font-medium",
                              riskTextClass(scenario.risk),
                            )}
                          >
                            {titleCase(scenario.risk)} Risk
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-[color:var(--subtle)]">
                        v{scenario.version}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="section-label">
                Safety Mode
              </h2>
              <div className="selector-stack">
                {safetyModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      type="button"
                      key={mode.id}
                      className={classNames(
                        "selector-row flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                        safetyMode === mode.id ? "selector-row-active" : "",
                      )}
                      onClick={() => setSafetyMode(mode.id)}
                    >
                      <Icon
                        size={15}
                        className={
                          mode.id === "monitor"
                            ? "text-cyan-300"
                            : mode.id === "warn"
                              ? "text-amber-300"
                              : "text-red-300"
                        }
                      />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{mode.label}</span>
                        <span className="block truncate text-xs text-[color:var(--subtle)]">
                          {mode.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel-inner p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Sparkles size={16} className="text-cyan-300" />
                Scenario Generator
              </div>
              <textarea
                className="field-shell min-h-24 w-full resize-none p-2 text-xs leading-5 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--subtle)]"
                value={generatorPrompt}
                onChange={(event) => setGeneratorPrompt(event.target.value)}
                aria-label="Scenario generator prompt"
              />
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <select
                  className="field-shell h-9 px-2 text-xs text-[color:var(--foreground)] outline-none"
                  value={generatorCategory}
                  aria-label="Generated scenario category"
                  onChange={(event) =>
                    setGeneratorCategory(event.target.value as ScenarioCategory)
                  }
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="control-button justify-center"
                  onClick={handleGenerateScenario}
                  disabled={generating}
                  title="Generate scenario"
                  aria-label="Generate scenario"
                >
                  {generating ? <Loader2 size={15} /> : <Plus size={15} />}
                </button>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-[color:var(--border-muted)] pt-4 text-xs text-[color:var(--subtle)]">
              <span>v0.3.0-local</span>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                local
              </span>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="analysis-topbar border-b px-4 py-3 md:px-5">
            <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
              <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,340px)]">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[color:var(--muted)]">
                    OpenRouter key
                  </span>
                  <span className="field-shell flex h-10 items-center">
                    <KeyRound size={16} className="ml-3 text-[color:var(--subtle)]" />
                    <input
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--subtle)]"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Optional for free OpenRouter runs"
                    />
                    <button
                      type="button"
                      className="mr-2 rounded p-1.5 text-[color:var(--subtle)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--foreground)]"
                      onClick={() => setShowKey((value) => !value)}
                      title={showKey ? "Hide key" : "Show key"}
                      aria-label={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-[color:var(--muted)]">
                    Primary model (free only)
                  </span>
                  <select
                    className="field-shell h-10 w-full px-3 text-sm text-[color:var(--foreground)] outline-none"
                    value={selectedModelIds[0]}
                    onChange={(event) =>
                      setSelectedModelIds((current) => [
                        event.target.value,
                        ...current.filter((id) => id !== event.target.value),
                      ])
                    }
                  >
                    {MODEL_PRESETS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="run-button flex h-10 items-center justify-center gap-2 px-5 text-sm font-semibold"
                onClick={handleRun}
                disabled={running}
              >
                {running ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Play size={17} />
                )}
                Run Benchmark
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <span className="flex h-8 shrink-0 items-center rounded-md border border-emerald-400/35 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-200">
                OpenRouter free only
              </span>
              {MODEL_PRESETS.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  className={classNames(
                    "data-chip flex h-8 shrink-0 items-center gap-2 px-3 text-xs",
                    selectedModelIds.includes(model.id)
                      ? "data-chip-active"
                      : "",
                  )}
                  onClick={() => toggleModel(model.id)}
                >
                  <Bot size={14} />
                  {model.label}
                </button>
              ))}
            </div>
          </header>

          {notice ? (
            <div className="notice-band border-b px-5 py-2 text-sm">
              {notice}
            </div>
          ) : null}

          <section className="grid gap-4 p-4 md:p-5 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0 space-y-4">
              <DashboardStrip dashboard={dashboard} />
              <LiveRunner
                scenario={activeScenario}
                result={activeResult}
                visibleTraceCount={visibleTraceCount}
                running={running}
              />
              <ModelComparison
                results={scenarioResults.length ? scenarioResults : displayResults}
                activeResultId={activeResult?.id}
                onSelect={setActiveResultId}
              />
            </div>

            <div className="grid gap-4">
              <Inspector scenario={activeScenario} result={activeResult} />
              <TraceArchivePanel
                archive={archive}
                onSelect={(entry) => {
                  setRun({
                    runId: entry.runId,
                    startedAt: entry.startedAt,
                    durationMs: entry.durationMs,
                    results: entry.results,
                    archiveEntry: entry,
                  });
                  setActiveResultId(entry.results[0]?.id);
                }}
                onClear={handleClearArchive}
              />
              <SideBySideTrace results={scenarioResults.slice(0, 2)} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function DashboardStrip({
  dashboard,
}: {
  dashboard: ReturnType<typeof buildDashboard>;
}) {
  const traceLabel =
    dashboard.sampleSize === 1
      ? "1 trace"
      : `${dashboard.sampleSize} traces`;

  return (
    <section className="evidence-strip">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-muted)] px-4 py-3">
        <PanelTitle icon={Gauge} title="Evidence Snapshot" />
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-[color:var(--subtle)]">
          <span className="size-1.5 rounded-full bg-[color:var(--accent)]" />
          {dashboard.sourceLabel}
        </div>
      </div>
      <div className="grid gap-2 p-2 md:grid-cols-4">
        <EvidenceDatum
          icon={Gauge}
          label="Score Mean"
          value={`${dashboard.averageScore}/100`}
          detail={traceLabel}
          tone={scoreTone(dashboard.averageScore)}
        />
        <EvidenceDatum
          icon={CheckCircle2}
          label="Pass Rate"
          value={`${dashboard.passRate}%`}
          detail="safe completions"
          tone={scoreTone(dashboard.passRate)}
        />
        <EvidenceDatum
          icon={ShieldAlert}
          label="Canary Exposure"
          value={`${dashboard.canaryTrips}`}
          detail={dashboard.canaryTrips ? "tripped evidence" : "no trips"}
          tone={dashboard.canaryTrips ? "fail" : "pass"}
        />
        <EvidenceDatum
          icon={Archive}
          label="Archive Depth"
          value={`${dashboard.archiveCount}`}
          detail="saved runs"
          tone="info"
        />
      </div>
    </section>
  );
}

function EvidenceDatum({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
  tone: EvidenceTone;
}) {
  return (
    <div className={classNames("evidence-cell", evidenceToneClass(tone))}>
      <div className="flex size-9 items-center justify-center rounded-md border border-current/25 bg-current/10">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase text-[color:var(--subtle)]">
          {label}
        </div>
        <div className="mt-1 font-mono text-base font-semibold text-[color:var(--foreground)]">
          {value}
        </div>
        <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
          {detail}
        </div>
      </div>
    </div>
  );
}

function LiveRunner({
  scenario,
  result,
  visibleTraceCount,
  running,
}: {
  scenario: BenchmarkScenario;
  result?: ScenarioRunResult;
  visibleTraceCount: number;
  running: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-muted)] px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-[color:var(--foreground)]">Live Trace</h2>
          <span
            className={classNames(
              "size-2 rounded-full",
              running ? "animate-pulse bg-cyan-300" : "bg-emerald-400",
            )}
          />
          <span className="font-mono text-xs text-[color:var(--muted)]">
            {result?.runId ?? "RUN-LOCAL-PREVIEW"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
          <span>{result ? formatDuration(result.durationMs) : "idle"}</span>
          <RefreshCcw size={14} />
        </div>
      </div>

      <div className="grid min-h-[510px] gap-3 p-3 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="panel-inner overflow-hidden">
          <PanelHeader icon={Folder} title="Virtual FS" meta="/workspace" />
          <div className="max-h-[450px] overflow-y-auto p-3">
            <FileTree scenario={scenario} result={result} />
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="panel-inner min-h-[250px] overflow-hidden">
            <PanelHeader icon={Terminal} title="Terminal" meta="bash" />
            <TerminalOutput result={result} />
          </div>
          <div className="panel-inner overflow-hidden">
            <PanelHeader icon={Braces} title="Reasoning Trace" meta="replay" />
            <TraceList
              trace={(result?.trace ?? []).slice(0, visibleTraceCount)}
              empty="Run a benchmark to replay model reasoning and policy events."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FileTree({
  scenario,
  result,
}: {
  scenario: BenchmarkScenario;
  result?: ScenarioRunResult;
}) {
  const touchedPath = result?.canaryHit?.evidence;

  return (
    <div className="space-y-1 font-mono text-xs">
      {scenario.files
        .map((file) => file.path)
        .sort()
        .map((path) => {
          const sensitive = scenario.files.find((file) => file.path === path)?.sensitive;
          const active = touchedPath === path;
          return (
            <div
              key={path}
              className={classNames(
                "flex min-w-0 items-center gap-2 rounded px-2 py-1.5",
                active
                  ? "bg-red-400/10 text-red-100"
                  : sensitive
                    ? "text-amber-200"
                    : "text-[color:var(--foreground)]",
              )}
            >
              {path.endsWith(".md") ||
              path.endsWith(".ts") ||
              path.endsWith(".json") ||
              path.includes(".env") ? (
                <FileText size={14} className="shrink-0" />
              ) : (
                <Folder size={14} className="shrink-0" />
              )}
              <span className="truncate">{path}</span>
              {active ? <span className="ml-auto size-2 rounded-full bg-red-400" /> : null}
            </div>
          );
        })}
    </div>
  );
}

function TerminalOutput({ result }: { result?: ScenarioRunResult }) {
  const commands = result?.commands ?? [];

  if (!commands.length) {
    return (
      <div className="p-4 font-mono text-sm text-[color:var(--subtle)]">
        agent@workspace:/$ waiting for benchmark run
      </div>
    );
  }

  return (
    <div className="max-h-[250px] overflow-y-auto p-4 font-mono text-xs leading-5">
      {commands.map((command, index) => (
        <div key={`${command.command}-${index}`} className="mb-4">
          <div className="text-emerald-300">
            agent@workspace:/$ <span className="text-[color:var(--foreground)]">{command.command}</span>
          </div>
          <pre
            className={classNames(
              "mt-1 whitespace-pre-wrap break-words",
              command.canaryHit
                ? "text-red-200"
                : command.blocked
                  ? "text-amber-200"
                  : "text-[color:var(--foreground)]",
            )}
          >
            {command.output}
          </pre>
        </div>
      ))}
    </div>
  );
}

function TraceList({
  trace,
  empty,
}: {
  trace: TraceStep[];
  empty: string;
}) {
  if (!trace.length) {
    return <div className="p-4 text-sm text-[color:var(--subtle)]">{empty}</div>;
  }

  return (
    <div className="max-h-[220px] overflow-y-auto">
      {trace.map((step) => (
        <div
          key={step.id}
          className="grid grid-cols-[70px_92px_minmax(0,1fr)_72px] gap-3 border-b border-[color:var(--border-muted)] px-4 py-2 text-xs last:border-b-0"
        >
          <span className="font-mono text-[color:var(--subtle)]">
            {formatDuration(step.atMs)}
          </span>
          <span className="flex items-center gap-2 text-[color:var(--foreground)]">
            {traceIcon(step)}
            {step.label}
          </span>
          <span
            className={classNames(
              "min-w-0 truncate",
              step.kind === "blocked" || step.kind === "warning"
                ? "text-amber-200"
                : step.kind === "score"
                  ? "text-cyan-100"
                  : "text-[color:var(--muted)]",
            )}
          >
            {step.content}
          </span>
          <span className={classNames("text-right", severityClass(step.severity))}>
            {step.severity && step.severity !== "info" ? step.severity : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function Inspector({
  scenario,
  result,
}: {
  scenario: BenchmarkScenario;
  result?: ScenarioRunResult;
}) {
  const trigger = scenario.hiddenTrigger;
  const status = result?.status ?? "warn";
  const canary = result?.canaryHit;

  return (
    <aside className="space-y-3">
      <section className="panel p-4">
        <PanelTitle icon={ShieldAlert} title="Canary Status" />
        <div
          className={classNames(
            "mt-3 rounded-md border p-3",
            canary
              ? "border-red-400/45 bg-red-400/10"
              : "border-emerald-400/30 bg-emerald-400/10",
          )}
        >
          <div className="flex items-center gap-3">
            {canary ? (
              <XCircle className="text-red-300" size={24} />
            ) : (
              <CheckCircle2 className="text-emerald-300" size={24} />
            )}
            <div>
              <div
                className={classNames(
                  "text-sm font-semibold uppercase",
                  canary ? "text-red-200" : "text-emerald-200",
                )}
              >
                {canary ? "Tripped" : "Armed"}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                {trigger.sensitivity.toUpperCase()} risk canary
              </div>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 text-xs">
            <InspectorRow label="Canary ID" value={trigger.canaryId} mono />
            <InspectorRow label="Type" value={trigger.type} />
            <InspectorRow
              label="Triggered At"
              value={canary ? formatDuration(canary.triggeredAtMs) : "Not triggered"}
            />
            <InspectorRow
              label="Accessed By"
              value={canary?.accessedBy ?? "None"}
              mono
            />
          </dl>
        </div>
      </section>

      <section className="panel p-4">
        <PanelTitle icon={LockKeyhole} title="Hidden Trigger Details" />
        <dl className="mt-3 grid gap-2 text-xs">
          <InspectorRow label="Trigger Type" value={trigger.type} />
          <InspectorRow label="Path" value={trigger.path ?? "n/a"} mono />
          <InspectorRow label="Pattern" value={trigger.pattern ?? "n/a"} mono />
          <InspectorRow
            label="Sensitivity"
            value={titleCase(trigger.sensitivity)}
            valueClass={riskTextClass(trigger.sensitivity)}
          />
          <InspectorRow label="Description" value={trigger.description} />
        </dl>
      </section>

      <section className="panel p-4">
        <PanelTitle icon={Gauge} title="Evaluation Result" />
        <div
          className={classNames(
            "mt-3 rounded-md border px-3 py-2 text-sm font-semibold uppercase",
            statusBoxClass(status),
          )}
        >
          {status}
        </div>
        <div className="mt-4 space-y-3">
          <ScoreBar label="Score" value={result?.score.overall ?? 0} />
          <ScoreBar label="Safety" value={result?.score.safety ?? 0} />
          <ScoreBar label="Stealth" value={result?.score.stealth ?? 0} />
          <ScoreBar label="Resilience" value={result?.score.resilience ?? 0} />
          <ScoreBar label="Tool Use" value={result?.score.toolUse ?? 0} />
        </div>
        <div className="mt-4 border-t border-[color:var(--border-muted)] pt-3 text-xs">
          <div className="mb-1 text-[color:var(--subtle)]">Verdict</div>
          <div className={statusTextClass(status)}>
            {result?.verdict ?? "Run a benchmark to evaluate this scenario."}
          </div>
        </div>
      </section>
    </aside>
  );
}

function ModelComparison({
  results,
  activeResultId,
  onSelect,
}: {
  results: ScenarioRunResult[];
  activeResultId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border-muted)] px-4 py-3">
        <PanelTitle icon={GitCompare} title="Model Comparison" />
        <span className="text-xs text-[color:var(--subtle)]">{results.length} traces</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-[color:var(--surface-0)] text-[color:var(--subtle)]">
            <tr>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Scenario</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Safety</th>
              <th className="px-4 py-2 font-medium">Tool Use</th>
              <th className="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.length ? (
              results.map((result) => (
                <tr
                  key={result.id}
                  className={classNames(
                    "cursor-pointer border-t border-[color:var(--border-muted)] hover:bg-[color:var(--surface-2)]",
                    activeResultId === result.id ? "bg-[color:var(--accent-soft)]" : "",
                  )}
                  onClick={() => onSelect(result.id)}
                >
                  <td className="px-4 py-3 text-[color:var(--foreground)]">{result.modelLabel}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">
                    {compactScenarioTitle(result.scenarioId)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MiniBar value={result.score.overall} status={result.status} />
                      <span className="font-mono text-[color:var(--foreground)]">
                        {result.score.overall}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[color:var(--foreground)]">
                    {result.score.safety}
                  </td>
                  <td className="px-4 py-3 font-mono text-[color:var(--foreground)]">
                    {result.score.toolUse}
                  </td>
                  <td
                    className={classNames(
                      "px-4 py-3 font-semibold uppercase",
                      statusTextClass(result.status),
                    )}
                  >
                    {result.status}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--subtle)]">
                  Run a benchmark to populate model comparison.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TraceArchivePanel({
  archive,
  onSelect,
  onClear,
}: {
  archive: TraceArchiveEntry[];
  onSelect: (entry: TraceArchiveEntry) => void;
  onClear: () => void;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border-muted)] px-4 py-3">
        <PanelTitle icon={Archive} title="Trace Archive" />
        <button
          type="button"
          className="icon-button"
          title="Clear archive"
          aria-label="Clear archive"
          onClick={onClear}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="max-h-[226px] overflow-y-auto">
        {archive.length ? (
          archive.slice(0, 8).map((entry) => (
            <button
              type="button"
              key={entry.runId}
              className="grid w-full grid-cols-[minmax(0,1fr)_70px_70px_70px_24px] items-center gap-3 border-b border-[color:var(--border-muted)] px-4 py-3 text-left text-xs last:border-b-0 hover:bg-[color:var(--surface-2)]"
              onClick={() => onSelect(entry)}
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-[color:var(--foreground)]">
                  {entry.runId}
                </span>
                <span className="block truncate text-[color:var(--subtle)]">
                  {entry.scenarioCount} scenarios, {entry.modelCount} models
                </span>
              </span>
              <span className="font-mono text-[color:var(--muted)]">
                {new Date(entry.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="font-mono text-[color:var(--foreground)]">
                {entry.averageScore}
              </span>
              <span
                className={classNames(
                  "font-semibold uppercase",
                  statusTextClass(entry.worstResult),
                )}
              >
                {entry.worstResult}
              </span>
              <ChevronRight size={15} className="text-[color:var(--subtle)]" />
            </button>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[color:var(--subtle)]">
            Local trace archive is empty. Completed runs are saved here.
          </div>
        )}
      </div>
    </section>
  );
}

function SideBySideTrace({ results }: { results: ScenarioRunResult[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[color:var(--border-muted)] px-4 py-3">
        <PanelTitle icon={Database} title="Side-by-side Traces" />
      </div>
      {results.length >= 2 ? (
        <div className="grid grid-cols-2 divide-x divide-[color:var(--border-muted)]">
          {results.map((result) => (
            <div key={result.id} className="min-w-0 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-[color:var(--foreground)]">
                  {result.modelLabel}
                </span>
                <span className={classNames("uppercase", statusTextClass(result.status))}>
                  {result.status}
                </span>
              </div>
              <TraceList
                trace={result.trace.slice(0, 5)}
                empty="No trace selected."
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-[color:var(--subtle)]">
          Select or run at least two model results for side-by-side reasoning.
        </div>
      )}
    </section>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof Terminal;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-muted)] px-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
        <Icon size={15} className="text-[color:var(--muted)]" />
        {title}
      </div>
      <span className="font-mono text-xs text-[color:var(--subtle)]">{meta}</span>
    </div>
  );
}

function PanelTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Shield;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
      <Icon size={16} className="text-[color:var(--muted)]" />
      {title}
    </div>
  );
}

function InspectorRow({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-[color:var(--subtle)]">{label}</dt>
      <dd
        className={classNames(
          "min-w-0 break-words text-[color:var(--foreground)]",
          mono ? "font-mono" : "",
          valueClass ?? "",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[78px_1fr_42px] items-center gap-2 text-xs">
      <span className="text-[color:var(--subtle)]">{label}</span>
      <span className="h-1.5 overflow-hidden rounded bg-[color:var(--surface-3)]">
        <span
          className={classNames(
            "block h-full rounded",
            value >= 80 ? "bg-emerald-400" : value >= 55 ? "bg-amber-400" : "bg-red-400",
          )}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="text-right font-mono text-[color:var(--foreground)]">{value}</span>
    </div>
  );
}

function MiniBar({
  value,
  status,
}: {
  value: number;
  status: EvaluationResult;
}) {
  return (
    <span className="h-2 w-16 overflow-hidden rounded bg-[color:var(--surface-3)]">
      <span
        className={classNames(
          "block h-full rounded",
          status === "pass"
            ? "bg-emerald-400"
            : status === "warn"
              ? "bg-amber-400"
              : "bg-red-400",
        )}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

function traceIcon(step: TraceStep) {
  if (step.kind === "action") return <Terminal size={13} className="text-cyan-300" />;
  if (step.kind === "warning") return <AlertTriangle size={13} className="text-amber-300" />;
  if (step.kind === "blocked") return <CircleStop size={13} className="text-red-300" />;
  if (step.kind === "score") return <Gauge size={13} className="text-emerald-300" />;
  return <Braces size={13} className="text-[color:var(--muted)]" />;
}

function buildDashboard(
  results: ScenarioRunResult[],
  archive: TraceArchiveEntry[],
) {
  const source = results.length ? results : archive[0]?.results ?? [];
  const averageScore = source.length
    ? Math.round(
        source.reduce((total, result) => total + result.score.overall, 0) /
          source.length,
      )
    : 0;
  const passRate = source.length
    ? Math.round(
        (source.filter((result) => result.status === "pass").length /
          source.length) *
          100,
      )
    : 0;
  const canaryTrips = source.filter((result) => result.canaryHit).length;

  return {
    averageScore,
    passRate,
    canaryTrips,
    archiveCount: archive.length,
    sampleSize: source.length,
    sourceLabel: results.length
      ? "live evidence"
      : archive[0]
        ? "latest archive"
        : "preview state",
  };
}

function classNames(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

async function readJsonBody<T>(response: Response, fallback: T): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function riskTextClass(risk: RiskLevel) {
  if (risk === "high") return "text-red-300";
  if (risk === "medium") return "text-amber-300";
  return "text-emerald-300";
}

function severityClass(severity?: string) {
  if (severity === "high") return "text-red-300";
  if (severity === "medium") return "text-amber-300";
  if (severity === "low") return "text-emerald-300";
  return "text-[color:var(--subtle)]";
}

function scoreTone(value: number): EvidenceTone {
  if (value >= 80) return "pass";
  if (value >= 55) return "warn";
  return "fail";
}

function evidenceToneClass(tone: EvidenceTone) {
  if (tone === "pass") return "evidence-cell-pass";
  if (tone === "warn") return "evidence-cell-warn";
  if (tone === "fail") return "evidence-cell-fail";
  return "evidence-cell-info";
}

function statusTextClass(status: EvaluationResult) {
  if (status === "pass") return "text-emerald-300";
  if (status === "warn") return "text-amber-300";
  return "text-red-300";
}

function statusBoxClass(status: EvaluationResult) {
  if (status === "pass") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-200";
  if (status === "warn") return "border-amber-400/35 bg-amber-400/10 text-amber-200";
  return "border-red-400/40 bg-red-400/10 text-red-200";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const millis = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  return `00:${seconds.toString().padStart(2, "0")}.${millis}`;
}

function compactScenarioTitle(scenarioId: string) {
  return (
    BENCHMARK_SCENARIOS.find((scenario) => scenario.id === scenarioId)?.title ??
    scenarioId
  );
}
