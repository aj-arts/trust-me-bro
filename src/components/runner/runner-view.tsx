"use client";

import {
  Bot,
  Brain,
  ChevronLeft,
  CheckCircle2,
  Circle,
  FilePenLine,
  FileText,
  KeyRound,
  Loader2,
  MessageSquareText,
  Play,
  ShieldAlert,
  Terminal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
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
        <HighlightedCode
          code={contents}
          language={languageForPath(path)}
          variant="pane"
          className="min-h-full p-5 text-sm leading-6"
        />
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

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
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
              <TraceEventCard key={`${event.seq}-${event.timestamp}`} event={event} compact={compact} />
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
  const meta = traceMeta(event.type);
  const [title, rest] = splitFirstLine(event.message);
  const path = title.replace(/^Wrote /, "");
  const body =
    event.type === "command" ? (
      <HighlightedCode
        code={event.message}
        language="bash"
        className={compact ? "p-2 text-xs leading-5" : "p-2.5 text-sm leading-6"}
      />
    ) : event.type === "tool_result" ? (
      <HighlightedCode
        code={event.message}
        language="text"
        className={compact ? "p-2 text-xs leading-5" : "p-2.5 text-sm leading-6"}
      />
    ) : event.type === "file_change" ? (
      <div className="space-y-1.5">
        <p className="truncate font-mono text-xs text-muted">{path}</p>
        {rest ? (
          <HighlightedCode
            code={rest}
            language={languageForPath(path)}
            className={compact ? "p-2 text-xs leading-5" : "p-2.5 text-sm leading-6"}
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

function traceMeta(type: RunnerTraceEvent["type"]) {
  switch (type) {
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

type SyntaxLanguage = "bash" | "json" | "markdown" | "text" | "ts" | "tsx";

function HighlightedCode({
  code,
  language,
  className = "",
  variant = "block",
}: {
  code: string;
  language: SyntaxLanguage | string;
  className?: string;
  variant?: "block" | "pane";
}) {
  const frame =
    variant === "pane"
      ? "overflow-x-auto bg-white font-mono text-[#263244]"
      : "overflow-x-auto rounded-md border border-[#d9dee8] bg-[#f8fafc] font-mono text-[#263244]";

  return (
    <pre className={`${frame} ${className}`}>
      <code>{highlightCode(code, language)}</code>
    </pre>
  );
}

function languageForPath(path: string): SyntaxLanguage {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".tsx")) return "tsx";
  if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".js") || lowerPath.endsWith(".jsx")) return "ts";
  if (lowerPath.endsWith(".json")) return "json";
  if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "markdown";
  if (lowerPath.endsWith(".sh") || lowerPath.endsWith(".bash")) return "bash";
  return "text";
}

const syntaxClass = {
  command: "text-[#075985] font-medium",
  comment: "text-[#64748b] italic",
  flag: "text-[#9a3412]",
  key: "text-[#6d28d9]",
  keyword: "text-[#0f5ea8] font-medium",
  number: "text-[#a15c00]",
  path: "text-[#475569]",
  string: "text-[#166534]",
} as const;

type SyntaxKind = keyof typeof syntaxClass;

function highlightCode(code: string, language: string): ReactNode[] {
  if (language === "json") {
    return highlightWith(code, /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/g, (token, index, source) => {
      if (token.startsWith('"')) return /^\s*:/.test(source.slice(index + token.length)) ? "key" : "string";
      if (/^-?\d/.test(token)) return "number";
      return "keyword";
    });
  }

  if (language === "bash") {
    return highlightWith(code, /(#.*|^\$[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:bash|cat|chmod|curl|echo|exit|find|grep|head|ls|mkdir|npm|pnpm|pwd|rg|sed|touch)\b|\s-{1,2}[\w-]+|\/[\w./:-]+)/gm, bashTokenKind);
  }

  if (language === "markdown") {
    return highlightWith(code, /(^#{1,6}[^\n]*|^```[^\n]*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\b(?:bash|cat|curl|echo|find|npm|pnpm)\b|\s-{1,2}[\w-]+|\/[\w./:-]+)/gm, (token) => {
      if (token.startsWith("#")) return "keyword";
      if (token.startsWith("```")) return "comment";
      if (token.startsWith("`")) return "string";
      if (token.startsWith("[")) return "path";
      return bashTokenKind(token);
    });
  }

  if (language === "ts" || language === "tsx") {
    return highlightWith(code, /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:async|await|boolean|class|const|else|export|extends|false|for|from|function|if|import|interface|let|new|null|number|return|string|true|type|undefined|var|while)\b|\b\d+(?:\.\d+)?\b)/g, (token) => {
      if (token.startsWith("//") || token.startsWith("/*")) return "comment";
      if (/^["'`]/.test(token)) return "string";
      if (/^\d/.test(token)) return "number";
      return "keyword";
    });
  }

  return [code];
}

function bashTokenKind(token: string): SyntaxKind {
  const trimmed = token.trim();
  if (trimmed.startsWith("#")) return "comment";
  if (trimmed.startsWith("$")) return "command";
  if (/^["']/.test(trimmed)) return "string";
  if (trimmed.startsWith("-")) return "flag";
  if (trimmed.startsWith("/")) return "path";
  return "keyword";
}

function highlightWith(
  code: string,
  pattern: RegExp,
  classify: (token: string, index: number, source: string) => SyntaxKind,
) {
  const nodes: ReactNode[] = [];
  let offset = 0;

  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) nodes.push(code.slice(offset, index));

    const token = match[0];
    nodes.push(
      <span key={`${index}-${token.length}`} className={syntaxClass[classify(token, index, code)]}>
        {token}
      </span>,
    );
    offset = index + token.length;
  }

  if (offset < code.length) nodes.push(code.slice(offset));
  return nodes.length ? nodes : [code];
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
