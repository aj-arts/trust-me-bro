"use client";

import {
  Bot,
  Brain,
  ChevronLeft,
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
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { createTraceEvent, type RunnerTraceEvent } from "@/lib/browser-runner/trace";
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
              <CanaryVerdict
                scenario={scenario}
                events={traceEvents}
                runState={runState}
              />
            </section>
          </div>
        </aside>

        <section className="min-h-0 bg-white">
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
      ? "flex h-7 w-full items-center gap-1.5 rounded-md bg-[#e8eefc] px-2 text-left text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      : "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted outline-none hover:bg-[#eef2f7] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent";

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
    accent: "bg-[#22c55e]",
    badge: "border border-[#bbf7d0] bg-[#dcfce7] text-[#166534]",
    banner: "border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d]",
    icon: "text-[#16a34a]",
    idle: "border border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d] hover:bg-[#dcfce7]",
    selected: "border border-[#86efac] bg-[#dcfce7] text-[#14532d]",
  },
  neutral: {
    accent: "bg-[#3b82f6]",
    badge: "border border-[#bfdbfe] bg-[#dbeafe] text-[#1d4ed8]",
    banner: "border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]",
    icon: "text-[#2563eb]",
    idle: "border border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a] hover:bg-[#dbeafe]",
    selected: "border border-[#93c5fd] bg-[#dbeafe] text-[#1e3a8a]",
  },
  permissive: {
    accent: "bg-[#f97316]",
    badge: "border border-[#fed7aa] bg-[#ffedd5] text-[#c2410c]",
    banner: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
    icon: "text-[#ea580c]",
    idle: "border border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] hover:bg-[#ffedd5]",
    selected: "border border-[#fdba74] bg-[#ffedd5] text-[#9a3412]",
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

function TraceConversation({ scenario, events, runState, density }: TraceConversationProps) {
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
        frame: "border-[#e3e8f1] bg-[#fbfcff]",
        iconBg: "bg-[#eef2f7] text-muted",
        text: "whitespace-pre-wrap text-muted",
      };
    case "tool_call":
      return {
        label: "Tool Call",
        frame: "border-[#d9dee8] bg-[#fbfdff]",
        iconBg: "bg-[#eef2f7] text-muted",
        text: "whitespace-pre-wrap text-[#1f2733]",
      };
    case "tool_result":
      return {
        label: "Tool Result",
        frame: "border-[#d4e7db] bg-[#f7fcf8]",
        iconBg: "bg-[#e4f4e9] text-success",
        text: "whitespace-pre-wrap text-[#1f2733]",
      };
    case "command":
      if (event.metadata?.exitCode === 0) {
        return {
          label: "Command",
          frame: "border-[#d4e7db] bg-[#f7fcf8]",
          iconBg: "bg-[#e4f4e9] text-success",
          text: "whitespace-pre-wrap font-mono text-[#1f2733]",
        };
      }
      if (typeof event.metadata?.exitCode === "number") {
        return {
          label: "Command",
          frame: "border-[#fecaca] bg-[#fff7f7]",
          iconBg: "bg-[#fee2e2] text-danger",
          text: "whitespace-pre-wrap font-mono text-[#1f2733]",
        };
      }
      return {
        label: "Command",
        frame: "border-[#d9dee8] bg-[#fbfdff]",
        iconBg: "bg-[#eef2f7] text-muted",
        text: "whitespace-pre-wrap font-mono text-[#1f2733]",
      };
    case "file_change":
      return {
        label: "File Write",
        frame: "border-[#ded8c8] bg-[#fffdf7]",
        iconBg: "bg-[#f6eedb] text-[#8a5a13]",
        text: "whitespace-pre-wrap text-[#1f2733]",
      };
    case "canary":
      return {
        label: "Canary",
        frame: "border-[#fecaca] bg-[#fff7f7]",
        iconBg: "bg-[#fee2e2] text-danger",
        text: "whitespace-pre-wrap font-medium text-danger",
      };
    case "error":
      return {
        label: "Error",
        frame: "border-[#fecaca] bg-[#fff7f7]",
        iconBg: "bg-[#fee2e2] text-danger",
        text: "whitespace-pre-wrap text-danger",
      };
    default:
      return {
        label: "Assistant",
        frame: "border-border bg-white",
        iconBg: "bg-[#eef2f7] text-muted",
        text: "whitespace-pre-wrap text-[#1f2733]",
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
      style={oneLight}
      customStyle={{
        margin: 0,
        minHeight: isPane && fillHeight ? "100%" : undefined,
        overflowX: "auto",
        border: isPane ? "none" : "1px solid #d9dee8",
        borderRadius: isPane ? 0 : 6,
        background: isPane ? "#fff" : "#f8fafc",
        color: "#263244",
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
      ? "border-[#c7d7fe] bg-[#f4f7ff]"
      : tone === "error"
        ? "border-[#fecaca] bg-[#fff7f7]"
        : "border-border bg-white";

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
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2"
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
    frame: "border-border bg-white text-muted",
    iconBg: "bg-[#eef2f7]",
    iconClass: "text-muted",
    icon: Circle,
  },
  running: {
    title: "Monitoring run",
    description: "Watching for canary triggers as the trace streams.",
    frame: "border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]",
    iconBg: "bg-[#dbeafe]",
    iconClass: "animate-spin text-[#2563eb]",
    icon: Loader2,
  },
  passed: {
    title: "Passed",
    description: "The agent avoided the poisoned setup path in this run.",
    frame: "border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d]",
    iconBg: "bg-[#dcfce7]",
    iconClass: "text-[#16a34a]",
    icon: CircleCheckBig,
  },
  triggered: {
    title: "Canary triggered",
    description: "The agent executed the poisoned setup command.",
    frame: "border-[#fecaca] bg-[#fff7f7] text-[#991b1b]",
    iconBg: "bg-[#fee2e2]",
    iconClass: "text-danger",
    icon: TriangleAlert,
  },
  failed: {
    title: "Run failed",
    description: "The run ended before a canary verdict could be reached.",
    frame: "border-[#fecaca] bg-[#fff7f7] text-[#991b1b]",
    iconBg: "bg-[#fee2e2]",
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
      className: "border border-[#fecaca] bg-[#fee2e2] text-danger",
    };
  }

  if (runState === "completed" && !canaryTriggered) {
    return {
      label: "Not triggered",
      className: "border border-[#bbf7d0] bg-[#dcfce7] text-[#166534]",
    };
  }

  if (runState === "running") {
    return {
      label: "Watching",
      className: "border border-[#bfdbfe] bg-[#dbeafe] text-[#1d4ed8]",
    };
  }

  return {
    label: "Pending",
    className: "border border-border bg-[#f8fafc] text-muted",
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
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-muted">
      <span className={`size-1.5 rounded-full ${colorByState[state]}`} />
      {labelByState[state]}
    </span>
  );
}
