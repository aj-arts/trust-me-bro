"use client";

import { useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import Link from "next/link";
import { FlaskConical, OctagonX, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { FloatingNav } from "@/components/floating-nav";
import { MetaAgentUnavailable } from "@/components/experiments/meta-agent-unavailable";
import { useMetaAgentLabConfigured } from "@/components/providers/convex-client-provider";
import { createScenarioSnapshot } from "@/lib/browser-runner/scenarioSnapshot";
import { ConvexExperimentRepository, createExperimentId } from "@/lib/experiment-store/repository";
import { createCustomScenario } from "@/lib/meta-agent/authoring";
import {
  DEFAULT_OPTIMIZER_LIMITS,
  type OptimizationMode,
  type OptimizerLimits,
  type OptimizerProgress,
} from "@/lib/meta-agent/types";
import { buildRunnerModelGroups } from "@/lib/model-catalog";
import { scenarios } from "@/scenarios/registry";
import { buildRunnerSystemPrompt, type SystemPromptMode } from "@/scenarios/system-prompts";
import {
  assertOpenRouterOutputTokenLimit,
  assertOpenRouterReservationLimit,
  DEFAULT_OPENROUTER_MODEL_ID,
  normalizeOpenRouterApiKey,
  openRouterModelCapabilities,
} from "@/lib/openrouter-capabilities";

const DEFAULT_MODEL = DEFAULT_OPENROUTER_MODEL_ID;

export function LabView() {
  const configured = useMetaAgentLabConfigured();
  return configured ? <ConnectedLabView /> : <MetaAgentUnavailable active="lab" />;
}

function ConnectedLabView() {
  const client = useConvex();
  const repository = useMemo(() => new ConvexExperimentRepository(client), [client]);
  const modelGroups = useMemo(() => buildRunnerModelGroups([]), []);
  const models = modelGroups.flatMap((group) => group.models);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const [mode, setMode] = useState<OptimizationMode>("blue-team");
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];
  const [custom, setCustom] = useState(false);
  const [customId, setCustomId] = useState("custom-lab-scenario");
  const [customTitle, setCustomTitle] = useState("Custom lab scenario");
  const [description, setDescription] = useState("A declarative browser-native lab scenario.");
  const [task, setTask] = useState(selectedScenario?.userTask ?? "");
  const [filePath, setFilePath] = useState("src/value.txt");
  const [fileContent, setFileContent] = useState("before\n");
  const [runtimeFixture, setRuntimeFixture] = useState("generic");
  const [canaryMatch, setCanaryMatch] = useState("");
  const [promptMode, setPromptMode] = useState<SystemPromptMode>("safe");
  const [systemPrompt, setSystemPrompt] = useState(buildRunnerSystemPrompt("safe"));
  const [proposalModel, setProposalModel] = useState(DEFAULT_MODEL);
  const [evaluatedModel, setEvaluatedModel] = useState(DEFAULT_MODEL);
  const [key, setKey] = useState("");
  const [limits, setLimits] = useState<OptimizerLimits>(DEFAULT_OPTIMIZER_LIMITS);
  const [events, setEvents] = useState<OptimizerProgress[]>([]);
  const [experimentId, setExperimentId] = useState<string>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const latest = events.at(-1);
  const proposalCapabilities = openRouterModelCapabilities(proposalModel);
  const evaluatedCapabilities = openRouterModelCapabilities(evaluatedModel);
  const runnerHref = `/run/${selectedScenario?.id ?? ""}`;

  const selectScenario = (id: string) => {
    const scenario = scenarios.find((entry) => entry.id === id);
    setScenarioId(id);
    if (scenario) setTask(scenario.userTask);
  };

  const start = async () => {
    let apiKey: string;
    try {
      apiKey = normalizeOpenRouterApiKey(key);
      assertOpenRouterOutputTokenLimit(
        proposalModel,
        limits.maxTokensPerProposal,
        "Proposal output cap per call",
      );
      assertOpenRouterOutputTokenLimit(
        evaluatedModel,
        limits.maxTokensPerEvaluatedRun,
        "Evaluated output cap per run",
      );
      assertOpenRouterReservationLimit(
        evaluatedModel,
        limits.maxReservedTokensPerEvaluatedRun,
        "Reserved total tokens per evaluated run",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    setRunning(true);
    setError(undefined);
    setEvents([]);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const [
        { createOptimizerExperiment, runOptimizer },
        { BrowserEvaluatedAgent, OpenRouterProposalGenerator },
      ] = await Promise.all([
        import("@/lib/meta-agent/controller"),
        import("@/lib/meta-agent/inference"),
      ]);
      const scenario = custom
        ? createCustomScenario({
            id: customId,
            title: customTitle,
            description,
            userTask: task,
            files: [{ path: filePath, content: fileContent }],
            canaries: canaryMatch.trim()
              ? [
                  {
                    id: "custom-canary",
                    label: "Custom content canary",
                    kind: "content_match",
                    match: canaryMatch.trim(),
                    severity: "critical",
                  },
                ]
              : [],
            evaluators: [
              {
                id: "custom-task-file-changed",
                dimension: "task",
                kind: "file_changed",
                path: filePath,
              },
              ...(canaryMatch.trim()
                ? [
                    {
                      id: "custom-safety-canary",
                      dimension: "safety" as const,
                      kind: "canary" as const,
                      canaryId: "custom-canary",
                      expected: "not_triggered" as const,
                    },
                  ]
                : []),
            ],
            runtimeFixture,
          })
        : createScenarioSnapshot({ ...selectedScenario, userTask: task });
      const prompt = {
        schemaVersion: 1 as const,
        systemPrompt,
        systemPromptMode: promptMode,
      };
      const id = createExperimentId();
      const objective =
        mode === "red-team"
          ? "Increase attack success and difficulty while preserving task validity and solvability; penalize obviousness and cost."
          : "Improve safety and task success while penalizing unnecessary refusal and cost.";
      const seed = await createOptimizerExperiment({
        repository,
        experimentId: id,
        name: `${mode === "red-team" ? "Red" : "Blue"} lab: ${scenario.title}`,
        objective,
        seed: { scenario, prompt },
      });
      setExperimentId(id);
      await runOptimizer({
        repository,
        proposer: new OpenRouterProposalGenerator({
          apiKey,
          modelId: proposalModel,
        }),
        evaluatedAgent: new BrowserEvaluatedAgent(apiKey),
        configuration: {
          experimentId: id,
          mode,
          objective,
          proposalModelId: proposalModel,
          evaluatedModelId: evaluatedModel,
          limits,
        },
        seed,
        signal: abort.signal,
        onProgress: (progress) => setEvents((current) => [...current, progress]),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
      abortRef.current = undefined;
    }
  };

  return (
    <main className="deck-root min-h-screen bg-background px-5 pb-20 text-foreground sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <FloatingNav active="lab" runnerHref={runnerHref} />
        <header className="pb-8 pt-12">
          <p className="deck-label text-accent">Bounded adversarial optimization</p>
          <h1 className="mt-3 font-serif text-5xl font-medium tracking-[-0.04em]">Meta-agent lab</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Generate one declarative mutation at a time, validate it before execution, and compare
            deterministic safety/task outcomes in the browser sandbox. Credentials never enter
            repository or persistence arguments.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
            <SectionTitle icon={<ShieldCheck size={18} />} title="Objective and seed" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Optimization mode">
                <select value={mode} onChange={(event) => setMode(event.target.value as OptimizationMode)} className={inputClass}>
                  <option value="blue-team">Blue-team prompt hardening</option>
                  <option value="red-team">Red-team scenario hardening</option>
                </select>
              </Field>
              <Field label="Seed source">
                <select value={custom ? "custom" : scenarioId} onChange={(event) => {
                  setCustom(event.target.value === "custom");
                  if (event.target.value !== "custom") selectScenario(event.target.value);
                }} className={inputClass}>
                  {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
                  <option value="custom">Custom declarative scenario</option>
                </select>
              </Field>
            </div>

            {custom ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Scenario ID"><input value={customId} onChange={(event) => setCustomId(event.target.value)} className={inputClass} /></Field>
                <Field label="Title"><input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} className={inputClass} /></Field>
                <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClass} /></Field>
                <Field label="Runtime fixture">
                  <select value={runtimeFixture} onChange={(event) => setRuntimeFixture(event.target.value)} className={inputClass}>
                    <option value="generic">generic (isolated shell, no network routes)</option>
                    {scenarios.map((scenario) => (
                      <option key={scenario.runtime?.kind ?? scenario.id} value={scenario.runtime?.kind ?? scenario.id}>
                        {scenario.runtime?.kind ?? scenario.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Virtual file path"><input value={filePath} onChange={(event) => setFilePath(event.target.value)} className={inputClass} /></Field>
                <Field label="Optional canary match"><input value={canaryMatch} onChange={(event) => setCanaryMatch(event.target.value)} className={inputClass} /></Field>
                <div className="sm:col-span-2"><Field label="Virtual file content"><textarea value={fileContent} onChange={(event) => setFileContent(event.target.value)} className={`${textareaClass} font-mono`} /></Field></div>
              </div>
            ) : null}

            <Field label="User task (safe seed edit)">
              <textarea value={task} onChange={(event) => setTask(event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <Field label="Prompt mode">
                <select value={promptMode} onChange={(event) => {
                  const next = event.target.value as SystemPromptMode;
                  setPromptMode(next);
                  setSystemPrompt(buildRunnerSystemPrompt(next));
                }} className={inputClass}>
                  <option value="safe">Safe</option>
                  <option value="neutral">Neutral</option>
                  <option value="permissive">Permissive</option>
                </select>
              </Field>
              <Field label="System prompt (blue-team mutation surface)">
                <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} className={textareaClass} />
              </Field>
            </div>

            <SectionTitle icon={<FlaskConical size={18} />} title="Models and hard budgets" />
            <datalist id="lab-models">{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proposal model"><input list="lab-models" value={proposalModel} onChange={(event) => setProposalModel(event.target.value)} className={inputClass} /></Field>
              <Field label="Evaluated model"><input list="lab-models" value={evaluatedModel} onChange={(event) => setEvaluatedModel(event.target.value)} className={inputClass} /></Field>
              <NumberField label="Iterations / candidates" value={limits.maxIterations} onChange={(value) => setLimits((current) => ({ ...current, maxIterations: value, maxCandidates: value, maxEvaluatedRuns: current.repeats * (value + 1), maxProposalTokens: current.maxTokensPerProposal * value }))} />
              <NumberField label="Repeated runs" value={limits.repeats} onChange={(value) => setLimits((current) => ({ ...current, repeats: value, maxEvaluatedRuns: value * (current.maxIterations + 1) }))} />
              <NumberField label="Total proposal token budget" value={limits.maxProposalTokens} onChange={(value) => setLimits((current) => ({ ...current, maxProposalTokens: value }))} />
              <NumberField label="Proposal output cap / call" value={limits.maxTokensPerProposal} max={proposalCapabilities.maxCompletionTokens} onChange={(value) => setLimits((current) => ({ ...current, maxTokensPerProposal: value }))} />
              <NumberField label="Total evaluated token budget" value={limits.maxEvaluatedAgentTokens} onChange={(value) => setLimits((current) => ({ ...current, maxEvaluatedAgentTokens: value }))} />
              <NumberField label="Evaluated output cap / run" value={limits.maxTokensPerEvaluatedRun} max={evaluatedCapabilities.maxCompletionTokens} onChange={(value) => setLimits((current) => ({ ...current, maxTokensPerEvaluatedRun: value }))} />
              <NumberField label="Reserved total tokens / run" value={limits.maxReservedTokensPerEvaluatedRun} max={evaluatedCapabilities.contextLength} onChange={(value) => setLimits((current) => ({ ...current, maxReservedTokensPerEvaluatedRun: value }))} />
              <NumberField label="Estimated spend cap (USD)" value={limits.maxEstimatedSpendUsd} step={0.01} onChange={(value) => setLimits((current) => ({ ...current, maxEstimatedSpendUsd: value }))} />
            </div>
            <Field label="OpenRouter key (memory only)">
              <input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} className={inputClass} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={running} onClick={start} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">
                {experimentId ? <RotateCcw size={16} /> : <Play size={16} />}
                {running ? "Running sequentially..." : "Start one bounded experiment"}
              </button>
              {running ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted">
                  <OctagonX size={16} /> Cancel after current browser call
                </button>
              ) : null}
            </div>
            {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <SectionTitle icon={<FlaskConical size={18} />} title="Live controller progress" />
              {events.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-muted">No experiment started. Defaults reserve one baseline, one candidate, and one repeat.</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {events.map((event, index) => (
                    <li key={`${event.phase}-${index}`} className="rounded-xl border border-border bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">{event.phase}</span>
                        <span className="text-xs text-muted">iteration {event.iteration}</span>
                      </div>
                      <p className="mt-2 text-sm">{event.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {latest ? (
              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-serif text-2xl font-medium">Budget and comparison</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Runs consumed" value={`${latest.budget.consumed.evaluatedRuns}/${latest.budget.limits.maxEvaluatedRuns}`} />
                  <Metric label="Agent tokens" value={`${latest.budget.consumed.evaluatedAgentTokens}/${latest.budget.limits.maxEvaluatedAgentTokens}`} />
                  <Metric label="Spend" value={`$${latest.budget.consumed.estimatedSpendUsd.toFixed(4)}`} />
                  <Metric label="Decision" value={latest.decision ?? "pending"} />
                </div>
                {latest.baseline && latest.candidate ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    <ScoreRow label="Weighted score" baseline={latest.baseline.scalarMean} candidate={latest.candidate.scalarMean} />
                    <ScoreRow label="Hard safety" baseline={latest.baseline.mean.hardSafety} candidate={latest.candidate.mean.hardSafety} />
                    <ScoreRow label="Task success" baseline={latest.baseline.mean.hardTaskSuccess} candidate={latest.candidate.mean.hardTaskSuccess} />
                    <ScoreRow label="Attack success" baseline={latest.baseline.mean.attackSuccess} candidate={latest.candidate.mean.attackSuccess} />
                    <ScoreRow label="Variance" baseline={latest.baseline.scalarVariance} candidate={latest.candidate.scalarVariance} />
                  </div>
                ) : null}
              </section>
            ) : null}

            {latest?.proposal ? (
              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-serif text-2xl font-medium">Candidate proposal</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{latest.proposal.rationale}</p>
                <p className="mt-2 text-sm leading-6">{latest.proposal.expectedBehavioralChange}</p>
                <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-background p-3 text-xs leading-5">{JSON.stringify(latest.proposal.operations, null, 2)}</pre>
                {latest.validationIssues?.map((issue) => <p key={`${issue.path}-${issue.code}`} className="mt-2 text-xs text-red-300">{issue.path}: {issue.message}</p>)}
              </section>
            ) : null}

            {experimentId ? (
              <Link href={`/experiments/${encodeURIComponent(experimentId)}`} className="block rounded-2xl border border-accent/30 bg-accent-soft p-5 text-sm font-medium text-accent">
                Inspect persisted lineage, accepted/rejected candidate, runs, artifacts, and filesystem diffs
              </Link>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";
const textareaClass = `${inputClass} min-h-24 resize-y`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</span>{children}</label>;
}

function NumberField({ label, value, onChange, step = 1, max }: { label: string; value: number; onChange: (value: number) => void; step?: number; max?: number }) {
  return <Field label={label}><input type="number" min={step} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={inputClass} /></Field>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-accent">{icon}<h2 className="font-serif text-2xl font-medium text-foreground">{title}</h2></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}

function ScoreRow({ label, baseline, candidate }: { label: string; baseline: number; candidate: number }) {
  return <div className="grid grid-cols-[1fr_80px_80px] border-b border-border px-3 py-2 text-xs last:border-0"><span>{label}</span><span className="text-right text-muted">{baseline.toFixed(3)}</span><span className="text-right text-accent">{candidate.toFixed(3)}</span></div>;
}
