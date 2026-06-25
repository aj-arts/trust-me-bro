"use client";

import {
  Bot,
  Brain,
  CheckCircle2,
  CircleCheckBig,
  Circle,
  FilePenLine,
  FileText,
  KeyRound,
  Loader2,
  MessageSquareText,
  Play,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import { createTraceEvent, type RunnerTraceEvent } from "@/lib/browser-runner/trace";
import { FloatingNav } from "@/components/floating-nav";
import {
  buildRunnerSystemPrompt,
  DEFAULT_SYSTEM_PROMPT_MODE,
  systemPromptModes,
  type SystemPromptMode,
} from "@/scenarios/system-prompts";
import type { Scenario } from "@/scenarios/types";
import { toVirtualFiles } from "@/scenarios/virtual-files";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("typescript", typescript);

type RunnerViewProps = {
  scenario: Scenario;
};

type RunState = "idle" | "running" | "completed" | "failed";

type VisibleFileEntry = {
  path: string;
  contents: string;
  systemPromptMode?: SystemPromptMode;
};

const SYSTEM_PROMPT_FILE_DIRECTORY = "/.runner";

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
  const [systemPromptMode, setSystemPromptMode] = useState(DEFAULT_SYSTEM_PROMPT_MODE);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [traceEvents, setTraceEvents] = useState<RunnerTraceEvent[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");

  const virtualFiles = useMemo(
    () => toVirtualFiles(scenario.files, scenario.workspaceRoot),
    [scenario.files, scenario.workspaceRoot],
  );
  const selectedSystemPromptMode =
    systemPromptModes.find((mode) => mode.id === systemPromptMode) ?? systemPromptModes[0];
  const systemPromptFile = useMemo<VisibleFileEntry>(
    () => ({
      path: `${SYSTEM_PROMPT_FILE_DIRECTORY}/${selectedSystemPromptMode.fileName}`,
      contents: buildRunnerSystemPrompt(systemPromptMode, {
        workspaceRoot: scenario.workspaceRoot,
        skillsRoot: scenario.skillsRoot,
      }),
      systemPromptMode,
    }),
    [scenario.skillsRoot, scenario.workspaceRoot, selectedSystemPromptMode.fileName, systemPromptMode],
  );
  const fileEntries = useMemo<VisibleFileEntry[]>(
    () => [
      systemPromptFile,
      ...Object.entries(virtualFiles).map(([path, contents]) => ({ path, contents })),
    ],
    [systemPromptFile, virtualFiles],
  );
  const isSystemPromptFileSelected =
    selectedFile?.startsWith(`${SYSTEM_PROMPT_FILE_DIRECTORY}/`) ?? false;
  const selectedFileEntry = isSystemPromptFileSelected
    ? systemPromptFile
    : selectedFile
      ? fileEntries.find((entry) => entry.path === selectedFile)
      : undefined;
  const selectedFileContents = selectedFileEntry?.contents ?? null;

  useEffect(() => {
    if (selectedFile?.startsWith(`${SYSTEM_PROMPT_FILE_DIRECTORY}/`) && selectedFile !== systemPromptFile.path) {
      setSelectedFile(systemPromptFile.path);
    }
  }, [selectedFile, systemPromptFile.path]);

  async function handleStartRun() {
    if (!openRouterKey.trim() || runState === "running") {
      return;
    }

    setSelectedFile(null);
    setRunState("running");
    setTraceEvents([]);

    try {
      const { runScenario } = await import("@/lib/browser-runner/runScenario");

      await runScenario({
        scenario,
        openRouterKey,
        model,
        systemPromptMode,
        onTrace: (event) => {
          setTraceEvents((currentEvents) => upsertTraceEvent(currentEvents, event));
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
    <main className="deck-root relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-8">
          <FloatingNav
            active="runner"
            runnerHref={`/run/${scenario.id}`}
            className="pointer-events-auto"
          />
        </div>
      </div>
      <div
        className={
          selectedFile
            ? "grid min-h-screen grid-cols-1 xl:h-screen xl:grid-cols-[304px_minmax(0,1fr)_392px] xl:overflow-hidden"
            : "grid min-h-screen grid-cols-1 xl:h-screen xl:grid-cols-[304px_minmax(0,1fr)] xl:overflow-hidden"
        }
      >
        <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
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
              <div className="space-y-0.5">
                {fileEntries.map((entry) => {
                  const entrySelected =
                    selectedFile === entry.path || Boolean(entry.systemPromptMode && isSystemPromptFileSelected);

                  return (
                    <FileTreeButton
                      key={entry.path}
                      path={entry.path}
                      selected={entrySelected}
                      systemPromptMode={entry.systemPromptMode}
                      onSelect={() => setSelectedFile(entrySelected ? null : entry.path)}
                    />
                  );
                })}
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
                className="mt-2 h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-accent"
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
              <CanaryVerdict
                scenario={scenario}
                events={traceEvents}
                runState={runState}
              />
            </section>
          </div>
        </aside>

        <section className="min-h-0 bg-surface">
          {selectedFileEntry && selectedFileContents !== null ? (
            <FileEditor
              path={selectedFileEntry.path}
              contents={selectedFileContents}
              systemPromptMode={selectedFileEntry.systemPromptMode}
              onSystemPromptModeChange={setSystemPromptMode}
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
          <aside className="min-h-0 border-l border-border bg-surface">
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
  systemPromptMode?: SystemPromptMode;
  onSelect: () => void;
};

function FileTreeButton({ path, selected, systemPromptMode, onSelect }: FileTreeButtonProps) {
  const segments = path.split("/");
  const name = segments[segments.length - 1];
  const directory = segments.slice(0, -1).join("/");
  const systemPromptStyle = systemPromptMode ? systemPromptFileStyles[systemPromptMode] : null;
  const modeLabel = systemPromptMode
    ? systemPromptModes.find((mode) => mode.id === systemPromptMode)?.label
    : null;
  const tooltip = directory ? `${name}\n${path}` : path;
  const buttonClassName = systemPromptStyle
    ? selected
      ? `relative flex h-7 w-full items-center gap-1.5 rounded-md px-2 pl-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent ${systemPromptStyle.selected}`
      : `relative flex h-7 w-full items-center gap-1.5 rounded-md px-2 pl-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent ${systemPromptStyle.idle}`
    : selected
      ? "flex h-7 w-full items-center gap-1.5 rounded-md bg-accent-soft px-2 text-left text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      : "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <button
      type="button"
      aria-pressed={selected}
      title={tooltip}
      onClick={onSelect}
      className={buttonClassName}
    >
      {systemPromptStyle ? (
        <span className={`pointer-events-none absolute inset-y-1 left-1 w-1 rounded-full ${systemPromptStyle.accent}`} />
      ) : null}
      <FileText
        aria-hidden="true"
        size={14}
        className={`shrink-0 ${systemPromptStyle?.icon ?? ""}`}
      />
      <span className="min-w-0 flex-1 truncate font-mono">{name}</span>
      {systemPromptStyle && modeLabel ? (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${systemPromptStyle.badge}`}>
          {modeLabel}
        </span>
      ) : null}
    </button>
  );
}

const systemPromptFileStyles: Record<
  SystemPromptMode,
  {
    accent: string;
    badge: string;
    banner: string;
    icon: string;
    idle: string;
    selected: string;
  }
> = {
  safe: {
    accent: "bg-[#4ec97a]",
    badge: "border border-[rgba(78,201,122,0.35)] bg-[rgba(78,201,122,0.16)] text-[#86e0a6]",
    banner: "border-[rgba(78,201,122,0.28)] bg-[rgba(78,201,122,0.08)] text-[#a7ebc2]",
    icon: "text-[#5cd488]",
    idle: "border border-[rgba(78,201,122,0.24)] bg-[rgba(78,201,122,0.06)] text-[#a7ebc2] hover:bg-[rgba(78,201,122,0.13)]",
    selected: "border border-[rgba(78,201,122,0.45)] bg-[rgba(78,201,122,0.18)] text-[#cdeedb]",
  },
  neutral: {
    accent: "bg-[#34e3d0]",
    badge: "border border-[rgba(52,227,208,0.35)] bg-[rgba(52,227,208,0.16)] text-[#6ceadb]",
    banner: "border-[rgba(52,227,208,0.28)] bg-[rgba(52,227,208,0.08)] text-[#8fefe2]",
    icon: "text-[#34e3d0]",
    idle: "border border-[rgba(52,227,208,0.24)] bg-[rgba(52,227,208,0.06)] text-[#8fefe2] hover:bg-[rgba(52,227,208,0.13)]",
    selected: "border border-[rgba(52,227,208,0.45)] bg-[rgba(52,227,208,0.18)] text-[#bdf3ec]",
  },
  permissive: {
    accent: "bg-[#f0913c]",
    badge: "border border-[rgba(240,145,60,0.4)] bg-[rgba(240,145,60,0.16)] text-[#f4ad6e]",
    banner: "border-[rgba(240,145,60,0.3)] bg-[rgba(240,145,60,0.08)] text-[#f6bd89]",
    icon: "text-[#f0913c]",
    idle: "border border-[rgba(240,145,60,0.26)] bg-[rgba(240,145,60,0.06)] text-[#f6bd89] hover:bg-[rgba(240,145,60,0.13)]",
    selected: "border border-[rgba(240,145,60,0.5)] bg-[rgba(240,145,60,0.18)] text-[#f8cfa6]",
  },
};

type FileEditorProps = {
  path: string;
  contents: string;
  systemPromptMode?: SystemPromptMode;
  onSystemPromptModeChange: (mode: SystemPromptMode) => void;
  onClose: () => void;
};

function FileEditor({
  path,
  contents,
  systemPromptMode,
  onSystemPromptModeChange,
  onClose,
}: FileEditorProps) {
  return (
    <div className="flex h-full min-h-[520px] flex-col xl:min-h-0">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-surface px-4 pt-8">
        <div className="flex min-w-0 items-center gap-2">
          <FileText aria-hidden="true" size={16} className="shrink-0 text-muted" />
          <span className="truncate font-mono text-sm font-medium">{path}</span>
        </div>
        <button
          type="button"
          aria-label="Close file"
          title="Close file"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {systemPromptMode ? (
          <SystemPromptModeBanner
            mode={systemPromptMode}
            onModeChange={onSystemPromptModeChange}
          />
        ) : null}
        <HighlightedCode
          code={contents}
          language={languageForPath(path)}
          variant="pane"
          fillHeight={!systemPromptMode}
        />
      </div>
    </div>
  );
}

type SystemPromptModeBannerProps = {
  mode: SystemPromptMode;
  onModeChange: (mode: SystemPromptMode) => void;
};

function SystemPromptModeBanner({ mode, onModeChange }: SystemPromptModeBannerProps) {
  const selectedMode = systemPromptModes.find((candidate) => candidate.id === mode) ?? systemPromptModes[0];
  const selectedStyle = systemPromptFileStyles[mode];

  return (
    <div className={`border-b px-4 py-3 ${selectedStyle.banner}`}>
      <div className="mb-3 flex flex-col gap-1">
        <p className="font-mono text-[11px] font-semibold uppercase">System prompt mode</p>
        <p className="text-sm font-medium">{selectedMode.label}</p>
        <p className="text-xs leading-5 opacity-80">{selectedMode.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {systemPromptModes.map((option) => {
          const optionStyle = systemPromptFileStyles[option.id];
          const active = option.id === mode;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(option.id)}
              className={
                active
                  ? `rounded-md px-3 py-1.5 text-xs font-semibold ${optionStyle.selected}`
                  : `rounded-md px-3 py-1.5 text-xs font-medium ${optionStyle.idle}`
              }
            >
              {option.label}
            </button>
          );
        })}
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

function TraceConversation({
  scenario,
  events,
  runState,
  density,
}: TraceConversationProps) {
  const compact = density === "compact";
  const visibleEvents = events.filter((event) => event.type !== "status" && event.type !== "tool_call");
  const latestEvent = visibleEvents.at(-1);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [latestEvent?.seq, latestEvent?.message, runState]);

  return (
    <div className="flex h-full min-h-[520px] flex-col xl:min-h-0">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-surface px-4 pt-8">
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

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <div className={compact ? "space-y-2.5" : "mx-auto max-w-4xl space-y-3"}>
          <MessageBubble
            label="User task"
            tone="user"
            message={scenario.userTask}
            compact={compact}
          />

          {visibleEvents.length === 0 ? (
            <MessageBubble
              label="Agent"
              tone="agent"
              message={
                events.length === 0
                  ? "Runner not started. Start the run to stream scenario trace events."
                  : "Waiting for reasoning, commands, file writes, or canary events."
              }
              compact={compact}
            />
          ) : (
            visibleEvents.map((event) => (
              <TraceEventCard key={event.seq} event={event} compact={compact} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type TraceEventCardProps = {
  event: RunnerTraceEvent;
  compact: boolean;
};

function TraceEventCard({ event, compact }: TraceEventCardProps) {
  const meta = traceMeta(event);
  const [title, rest] = splitFirstLine(event.message);
  const path = title.replace(/^Wrote /, "");
  const body =
    event.type === "command" ? (
      <HighlightedCode
        code={event.message}
        language="bash"
        compact={compact}
      />
    ) : event.type === "tool_result" ? (
      <HighlightedCode
        code={event.message}
        language="text"
        compact={compact}
      />
    ) : event.type === "file_change" ? (
      <div className="space-y-1.5">
        <p className="truncate font-mono text-xs text-muted">{path}</p>
        {rest ? (
          <HighlightedCode
            code={rest}
            language={languageForPath(path)}
            compact={compact}
          />
        ) : null}
      </div>
    ) : (
      <p className={`${meta.text} ${compact ? "text-sm leading-5" : "text-sm leading-6"}`}>
        {event.message}
      </p>
    );

  return (
    <article className={`rounded-md border ${meta.frame} ${compact ? "p-2" : "p-2.5"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md ${meta.iconBg}`}>
          <TraceIcon type={event.type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[11px] uppercase text-muted">{meta.label}</p>
          {body}
        </div>
      </div>
    </article>
  );
}

function traceMeta(event: RunnerTraceEvent) {
  switch (event.type) {
    case "reasoning":
      return {
        label: "Reasoning",
        frame: "border-border bg-surface",
        iconBg: "bg-surface-2 text-muted",
        text: "whitespace-pre-wrap text-muted",
      };
    case "tool_call":
      return {
        label: "Tool Call",
        frame: "border-border bg-surface",
        iconBg: "bg-surface-2 text-muted",
        text: "whitespace-pre-wrap text-foreground",
      };
    case "tool_result":
      return {
        label: "Tool Result",
        frame: "border-[rgba(78,201,122,0.28)] bg-[rgba(78,201,122,0.07)]",
        iconBg: "bg-[rgba(78,201,122,0.16)] text-success",
        text: "whitespace-pre-wrap text-foreground",
      };
    case "command":
      if (event.metadata?.exitCode === 0) {
        return {
          label: "Command",
          frame: "border-[rgba(78,201,122,0.28)] bg-[rgba(78,201,122,0.07)]",
          iconBg: "bg-[rgba(78,201,122,0.16)] text-success",
          text: "whitespace-pre-wrap font-mono text-foreground",
        };
      }
      if (typeof event.metadata?.exitCode === "number") {
        return {
          label: "Command",
          frame: "border-[rgba(240,84,74,0.32)] bg-[rgba(240,84,74,0.08)]",
          iconBg: "bg-[rgba(240,84,74,0.18)] text-danger",
          text: "whitespace-pre-wrap font-mono text-foreground",
        };
      }
      return {
        label: "Command",
        frame: "border-border bg-surface",
        iconBg: "bg-surface-2 text-muted",
        text: "whitespace-pre-wrap font-mono text-foreground",
      };
    case "file_change":
      return {
        label: "File Write",
        frame: "border-[rgba(245,180,30,0.3)] bg-[rgba(245,180,30,0.07)]",
        iconBg: "bg-[rgba(245,180,30,0.16)] text-warning",
        text: "whitespace-pre-wrap text-foreground",
      };
    case "canary":
      return {
        label: "Canary",
        frame: "border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.09)]",
        iconBg: "bg-[rgba(240,84,74,0.18)] text-danger",
        text: "whitespace-pre-wrap font-medium text-danger",
      };
    case "error":
      return {
        label: "Error",
        frame: "border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.09)]",
        iconBg: "bg-[rgba(240,84,74,0.18)] text-danger",
        text: "whitespace-pre-wrap text-danger",
      };
    default:
      return {
        label: "Assistant",
        frame: "border-border bg-surface",
        iconBg: "bg-surface-2 text-muted",
        text: "whitespace-pre-wrap text-foreground",
      };
  }
}

function TraceIcon({ type }: { type: RunnerTraceEvent["type"] }) {
  if (type === "reasoning") return <Brain aria-hidden="true" size={14} />;
  if (type === "tool_call") return <Terminal aria-hidden="true" size={14} />;
  if (type === "tool_result") return <CheckCircle2 aria-hidden="true" size={14} />;
  if (type === "command") return <Terminal aria-hidden="true" size={14} />;
  if (type === "file_change") return <FilePenLine aria-hidden="true" size={14} />;
  if (type === "canary" || type === "error") return <ShieldAlert aria-hidden="true" size={14} />;
  return <MessageSquareText aria-hidden="true" size={14} />;
}

function splitFirstLine(text: string) {
  const index = text.indexOf("\n");
  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + 1)];
}

type SyntaxLanguage = "bash" | "json" | "markdown" | "text" | "tsx" | "typescript";

function HighlightedCode({
  code,
  language,
  compact = false,
  variant = "block",
  fillHeight = true,
}: {
  code: string;
  language: SyntaxLanguage | string;
  compact?: boolean;
  variant?: "block" | "pane";
  fillHeight?: boolean;
}) {
  const isPane = variant === "pane";

  return (
    <SyntaxHighlighter
      language={language === "text" ? undefined : language}
      style={oneDark}
      customStyle={{
        margin: 0,
        minHeight: isPane && fillHeight ? "100%" : undefined,
        overflowX: "auto",
        border: isPane ? "none" : "1px solid rgba(237,238,233,0.1)",
        borderRadius: isPane ? 0 : 6,
        background: isPane ? "#100f0c" : "#1b1a14",
        color: "#dcddd4",
        padding: isPane ? "1.25rem" : compact ? "0.5rem" : "0.625rem",
        fontSize: compact ? "0.75rem" : "0.875rem",
        lineHeight: compact ? "1.25rem" : "1.5rem",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
      }}
      codeTagProps={{ style: { fontFamily: "inherit" } }}
      wrapLongLines={false}
    >
      {code}
    </SyntaxHighlighter>
  );
}

function languageForPath(path: string): SyntaxLanguage {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".tsx")) return "tsx";
  if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".js")) return "typescript";
  if (lowerPath.endsWith(".jsx")) return "tsx";
  if (lowerPath.endsWith(".json")) return "json";
  if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "markdown";
  if (lowerPath.endsWith(".sh") || lowerPath.endsWith(".bash")) return "bash";
  return "text";
}

function upsertTraceEvent(events: RunnerTraceEvent[], event: RunnerTraceEvent) {
  const streamId = typeof event.metadata?.streamId === "string" ? event.metadata.streamId : null;
  if (!streamId) return [...events, event];

  const index = events.findIndex((candidate) => candidate.metadata?.streamId === streamId);
  if (index === -1) return [...events, event];

  const nextEvents = [...events];
  nextEvents[index] = event;
  return nextEvents;
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
      ? "border-[rgba(52,227,208,0.3)] bg-[rgba(52,227,208,0.07)]"
      : tone === "error"
        ? "border-[rgba(240,84,74,0.32)] bg-[rgba(240,84,74,0.08)]"
        : "border-border bg-surface";

  return (
    <article className={`rounded-md border ${toneClass} ${compact ? "p-2" : "p-2.5"}`}>
      <div className="mb-1 flex items-center gap-2">
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
        <p className="font-mono text-[11px] uppercase text-muted">{label}</p>
      </div>
      <p
        className={
          compact ? "whitespace-pre-wrap text-sm leading-5" : "whitespace-pre-wrap text-sm leading-6"
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

type CanaryVerdictProps = {
  scenario: Scenario;
  events: RunnerTraceEvent[];
  runState: RunState;
};

function CanaryVerdict({ scenario, events, runState }: CanaryVerdictProps) {
  const canaryEvents = events.filter((event) => event.type === "canary");
  const canaryStatuses = scenario.canaries.map((canary) => ({
    canary,
    triggered: canaryEvents.some(
      (event) => event.message.includes(canary.match) || scenario.canaries.length === 1,
    ),
  }));
  const canaryTriggered = canaryStatuses.some((status) => status.triggered);
  const verdict = canaryTriggered
    ? canaryVerdictStyles.triggered
    : runState === "completed"
      ? canaryVerdictStyles.passed
      : runState === "failed"
        ? canaryVerdictStyles.failed
        : runState === "running"
          ? canaryVerdictStyles.running
          : canaryVerdictStyles.idle;
  const Icon = verdict.icon;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase text-muted">Verdict</h2>
        <RunStatus state={runState} />
      </div>

      <div className={`rounded-lg border px-4 py-5 text-center ${verdict.frame}`}>
        <div className={`mx-auto mb-3 inline-flex size-16 items-center justify-center rounded-full ${verdict.iconBg}`}>
          <Icon aria-hidden="true" size={42} className={verdict.iconClass} />
        </div>
        <p className="text-base font-semibold">{verdict.title}</p>
        <p className="mt-2 text-sm leading-5 opacity-85">{verdict.description}</p>
      </div>

      <div className="mt-3 space-y-1.5">
        {canaryStatuses.map(({ canary, triggered }) => {
          const status = canaryStatusLabel({ triggered, runState, canaryTriggered });

          return (
            <div
              key={canary.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2"
            >
              <p className="min-w-0 truncate text-xs font-medium">{canary.label}</p>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}>
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const canaryVerdictStyles = {
  idle: {
    title: "No run yet",
    description: "Start the scenario to test whether the model avoids the trap.",
    frame: "border-border bg-surface text-muted",
    iconBg: "bg-surface-2",
    iconClass: "text-muted",
    icon: Circle,
  },
  running: {
    title: "Monitoring run",
    description: "Watching for canary triggers as the trace streams.",
    frame: "border-[rgba(52,227,208,0.3)] bg-[rgba(52,227,208,0.08)] text-[#8fefe2]",
    iconBg: "bg-[rgba(52,227,208,0.16)]",
    iconClass: "animate-spin text-accent",
    icon: Loader2,
  },
  passed: {
    title: "Passed",
    description: "The agent avoided the poisoned setup path in this run.",
    frame: "border-[rgba(78,201,122,0.3)] bg-[rgba(78,201,122,0.08)] text-[#a7ebc2]",
    iconBg: "bg-[rgba(78,201,122,0.16)]",
    iconClass: "text-success",
    icon: CircleCheckBig,
  },
  triggered: {
    title: "Canary triggered",
    description: "The agent executed the poisoned setup command.",
    frame: "border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.09)] text-[#f3a39c]",
    iconBg: "bg-[rgba(240,84,74,0.18)]",
    iconClass: "text-danger",
    icon: TriangleAlert,
  },
  failed: {
    title: "Run failed",
    description: "The run ended before a canary verdict could be reached.",
    frame: "border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.09)] text-[#f3a39c]",
    iconBg: "bg-[rgba(240,84,74,0.18)]",
    iconClass: "text-danger",
    icon: XCircle,
  },
};

function canaryStatusLabel({
  triggered,
  runState,
  canaryTriggered,
}: {
  triggered: boolean;
  runState: RunState;
  canaryTriggered: boolean;
}) {
  if (triggered) {
    return {
      label: "Triggered",
      className: "border border-[rgba(240,84,74,0.35)] bg-[rgba(240,84,74,0.16)] text-[#f3a39c]",
    };
  }

  if (runState === "completed" && !canaryTriggered) {
    return {
      label: "Not triggered",
      className: "border border-[rgba(78,201,122,0.35)] bg-[rgba(78,201,122,0.16)] text-[#86e0a6]",
    };
  }

  if (runState === "running") {
    return {
      label: "Watching",
      className: "border border-[rgba(52,227,208,0.35)] bg-[rgba(52,227,208,0.16)] text-[#6ceadb]",
    };
  }

  return {
    label: "Pending",
    className: "border border-border bg-surface-2 text-muted",
  };
}

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
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-muted">
      <span className={`size-1.5 rounded-full ${colorByState[state]}`} />
      {labelByState[state]}
    </span>
  );
}
