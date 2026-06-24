"use client";

import {
  Bot,
  ChevronLeft,
  Circle,
  FileText,
  KeyRound,
  Loader2,
  Play,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createTraceEvent, type RunnerTraceEvent } from "@/lib/browser-runner/trace";
import type { Scenario } from "@/scenarios/types";

type RunnerViewProps = {
  scenario: Scenario;
};

type RunState = "idle" | "running" | "completed" | "failed";

const modelGroups = [
  {
    label: "Free",
    models: [
      "openrouter/free",
      "openrouter/owl-alpha",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "poolside/laguna-m.1:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-oss-120b:free",
      "poolside/laguna-xs.2:free",
      "openai/gpt-oss-20b:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "cohere/north-mini-code:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "nvidia/nemotron-nano-12b-v2-vl:free",
      "google/gemma-4-26b-a4b-it:free",
      "liquid/lfm-2.5-1.2b-thinking:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-coder:free",
    ],
  },
  {
    label: "Paid",
    models: [
      "openai/gpt-4.1-mini",
      "anthropic/claude-sonnet-4",
      "google/gemini-2.5-flash",
    ],
  },
] as const;

export function RunnerView({ scenario }: RunnerViewProps) {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [model, setModel] = useState("openrouter/free");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [traceEvents, setTraceEvents] = useState<RunnerTraceEvent[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");

  const fileEntries = useMemo(() => Object.entries(scenario.files), [scenario.files]);
  const selectedFileContents = selectedFile ? scenario.files[selectedFile] : null;

  async function handleStartRun() {
    if (!openRouterKey.trim() || runState === "running") {
      return;
    }

    setRunState("running");
    setTraceEvents([]);

    try {
      const { runScenario } = await import("@/lib/browser-runner/runScenario");

      await runScenario({
        scenario,
        openRouterKey,
        model,
        onTrace: (event) => {
          setTraceEvents((currentEvents) => [...currentEvents, event]);
        },
      });
      setRunState("completed");
    } catch (error) {
      setRunState("failed");
      setTraceEvents((currentEvents) => [
        ...currentEvents,
        createTraceEvent(
          currentEvents.length,
          "error",
          error instanceof Error ? error.message : "Runner failed.",
        ),
      ]);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-foreground">
      <div
        className={
          selectedFile
            ? "grid min-h-screen grid-cols-1 xl:h-screen xl:grid-cols-[304px_minmax(0,1fr)_392px] xl:overflow-hidden"
            : "grid min-h-screen grid-cols-1 xl:h-screen xl:grid-cols-[304px_minmax(0,1fr)] xl:overflow-hidden"
        }
      >
        <aside className="flex min-h-0 flex-col border-r border-border bg-[#fbfcff]">
          <div className="border-b border-border px-4 py-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground"
            >
              <ChevronLeft aria-hidden="true" size={16} />
              Dashboard
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-border px-4 py-4">
              <p className="font-mono text-xs uppercase text-muted">{scenario.id}</p>
              <h1 className="mt-2 text-xl font-semibold">{scenario.title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted">{scenario.description}</p>
            </section>

            <section className="border-b border-border px-3 py-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase text-muted">Files</h2>
                <span className="font-mono text-xs text-muted">{fileEntries.length}</span>
              </div>
              <div className="space-y-1">
                {fileEntries.map(([path]) => (
                  <FileTreeButton
                    key={path}
                    path={path}
                    selected={selectedFile === path}
                    onSelect={() => setSelectedFile(path)}
                  />
                ))}
              </div>
            </section>

            <section className="border-b border-border px-4 py-4">
              <h2 className="text-xs font-semibold uppercase text-muted">Run setup</h2>
              <label
                className="mt-4 flex items-center gap-2 text-sm font-medium"
                htmlFor="openrouter-key"
              >
                <KeyRound aria-hidden="true" size={15} />
                OpenRouter key
              </label>
              <input
                id="openrouter-key"
                value={openRouterKey}
                onChange={(event) => setOpenRouterKey(event.target.value)}
                type="password"
                placeholder="sk-or-..."
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 font-mono text-sm outline-none focus:border-accent"
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                {modelGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.models.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <button
                type="button"
                disabled={!openRouterKey.trim() || runState === "running"}
                onClick={handleStartRun}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runState === "running" ? (
                  <Loader2 aria-hidden="true" className="animate-spin" size={16} />
                ) : (
                  <Play aria-hidden="true" size={16} />
                )}
                {runState === "running" ? "Running" : "Start run"}
              </button>
            </section>

            <section className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase text-muted">Canaries</h2>
                <RunStatus state={runState} />
              </div>
              <div className="space-y-2">
                {scenario.canaries.map((canary) => (
                  <div
                    key={canary.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2"
                  >
                    <p className="min-w-0 truncate text-sm font-medium">{canary.label}</p>
                    <p className="shrink-0 font-mono text-xs text-muted">{canary.kind}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className="min-h-0 bg-white">
          {selectedFile && selectedFileContents !== null ? (
            <FileEditor
              path={selectedFile}
              contents={selectedFileContents}
              onClose={() => setSelectedFile(null)}
            />
          ) : (
            <TraceConversation
              scenario={scenario}
              events={traceEvents}
              runState={runState}
              density="roomy"
            />
          )}
        </section>

        {selectedFile ? (
          <aside className="min-h-0 border-l border-border bg-white">
            <TraceConversation
              scenario={scenario}
              events={traceEvents}
              runState={runState}
              density="compact"
            />
          </aside>
        ) : null}
      </div>
    </main>
  );
}

type FileTreeButtonProps = {
  path: string;
  selected: boolean;
  onSelect: () => void;
};

function FileTreeButton({ path, selected, onSelect }: FileTreeButtonProps) {
  const segments = path.split("/");
  const name = segments[segments.length - 1];
  const directory = segments.slice(0, -1).join("/");

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={
        selected
          ? "flex w-full items-center gap-2 rounded-md bg-[#e8eefc] px-2 py-2 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted outline-none hover:bg-[#eef2f7] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      }
    >
      <FileText aria-hidden="true" size={16} className="shrink-0" />
      <span className="min-w-0 truncate font-mono">
        {directory ? (
          <span className="text-muted">{directory}/</span>
        ) : null}
        <span>{name}</span>
      </span>
    </button>
  );
}

type FileEditorProps = {
  path: string;
  contents: string;
  onClose: () => void;
};

function FileEditor({ path, contents, onClose }: FileEditorProps) {
  return (
    <div className="flex h-full min-h-[520px] flex-col xl:min-h-0">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-[#fbfcff] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText aria-hidden="true" size={16} className="shrink-0 text-muted" />
          <span className="truncate font-mono text-sm font-medium">{path}</span>
        </div>
        <button
          type="button"
          aria-label="Close file"
          title="Close file"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-[#eef2f7] hover:text-foreground"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <pre className="min-h-full p-5 font-mono text-sm leading-6 text-[#263244]">
          <code>{contents}</code>
        </pre>
      </div>
    </div>
  );
}

type TraceConversationProps = {
  scenario: Scenario;
  events: RunnerTraceEvent[];
  runState: RunState;
  density: "roomy" | "compact";
};

function TraceConversation({ scenario, events, runState, density }: TraceConversationProps) {
  const compact = density === "compact";

  return (
    <div className="flex h-full min-h-[520px] flex-col xl:min-h-0">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-[#fbfcff] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Bot aria-hidden="true" size={17} className="shrink-0 text-muted" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Agent trace</h2>
            {!compact ? (
              <p className="truncate text-xs text-muted">Task prompt and runner events</p>
            ) : null}
          </div>
        </div>
        <RunStatus state={runState} />
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
        <div className={compact ? "space-y-4" : "mx-auto max-w-3xl space-y-5"}>
          <MessageBubble
            label="User task"
            tone="user"
            message={scenario.userTask}
            compact={compact}
          />

          {events.length === 0 ? (
            <MessageBubble
              label="Agent"
              tone="agent"
              message="Runner not started. Start the run to stream scenario trace events."
              compact={compact}
            />
          ) : (
            events.map((event) => (
              <MessageBubble
                key={`${event.seq}-${event.timestamp}`}
                label={event.type}
                tone={event.type === "error" ? "error" : "agent"}
                message={event.message}
                compact={compact}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  label: string;
  tone: "user" | "agent" | "error";
  message: string;
  compact: boolean;
};

function MessageBubble({ label, tone, message, compact }: MessageBubbleProps) {
  const toneClass =
    tone === "user"
      ? "border-[#c7d7fe] bg-[#f4f7ff]"
      : tone === "error"
        ? "border-[#fecaca] bg-[#fff7f7]"
        : "border-border bg-white";

  return (
    <article className={`rounded-lg border ${toneClass} ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-2 flex items-center gap-2">
        <Circle
          aria-hidden="true"
          size={8}
          className={
            tone === "user"
              ? "fill-accent text-accent"
              : tone === "error"
                ? "fill-danger text-danger"
                : "fill-muted text-muted"
          }
        />
        <p className="font-mono text-xs uppercase text-muted">{label}</p>
      </div>
      <p
        className={
          compact ? "whitespace-pre-wrap text-sm leading-6" : "whitespace-pre-wrap text-base leading-7"
        }
      >
        {message}
      </p>
    </article>
  );
}

type RunStatusProps = {
  state: RunState;
};

function RunStatus({ state }: RunStatusProps) {
  const labelByState: Record<RunState, string> = {
    idle: "Idle",
    running: "Running",
    completed: "Complete",
    failed: "Failed",
  };

  const colorByState: Record<RunState, string> = {
    idle: "bg-muted",
    running: "bg-accent",
    completed: "bg-success",
    failed: "bg-danger",
  };

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-muted">
      <span className={`size-1.5 rounded-full ${colorByState[state]}`} />
      {labelByState[state]}
    </span>
  );
}
