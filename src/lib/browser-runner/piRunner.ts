import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type StreamFn,
} from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { Type } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import {
  createSandbox,
  snapshotSandboxFiles,
  type BrowserSandbox,
} from "./createSandbox.ts";
import type { OpenRouterSession } from "./openrouterClient.ts";
import { toRedactedJson } from "./redaction.ts";
import { createRuntimeFixture } from "./runtimeFixtures.ts";
import type { ScenarioSnapshot } from "./scenarioSnapshot.ts";
import type { TraceRecorder } from "./trace.ts";
import type {
  JsonValue,
  ProviderRequestArtifact,
  RunErrorArtifact,
  RunUsage,
  ToolInvocationArtifact,
  VirtualFiles,
} from "./types.ts";

export type PiRunnerRuntime = {
  model: Model<string>;
  modelId?: string;
  streamFn: StreamFn;
  getApiKey?: (provider: string) => string | undefined | Promise<string | undefined>;
};

export type PiRunnerInput = {
  scenario: ScenarioSnapshot;
  effectiveSystemPrompt: string;
  trace: TraceRecorder;
  runtime?: PiRunnerRuntime;
  session?: OpenRouterSession;
  now?: () => number;
};

export type PiRunnerResult = {
  transcript: JsonValue[];
  toolInvocations: ToolInvocationArtifact[];
  providerRequests: ProviderRequestArtifact[];
  usage: RunUsage[];
  stopReasons: string[];
  errors: RunErrorArtifact[];
  initialFiles: VirtualFiles;
  finalFiles: VirtualFiles;
  triggeredCanaryIds: Set<string>;
};

export async function runPiAgent(input: PiRunnerInput): Promise<PiRunnerResult> {
  const now = input.now ?? Date.now;
  const runtime = input.runtime ?? liveRuntime(input.session);
  const errors: RunErrorArtifact[] = [];
  const providerRequests: ProviderRequestArtifact[] = [];
  const toolInvocations: ToolInvocationArtifact[] = [];
  const triggeredCanaryIds = new Set<string>();

  const triggerCanary = (canaryId: string, reason: string) => {
    if (triggeredCanaryIds.has(canaryId)) return;
    const canary = input.scenario.canaries.find((candidate) => candidate.id === canaryId);
    if (!canary) return;
    triggeredCanaryIds.add(canaryId);
    input.trace.emit("canary", `Canary triggered: ${canary.match} (${reason})`, {
      canaryId,
      reason,
      severity: canary.severity,
    });
  };
  const fixture = createRuntimeFixture({
    scenario: input.scenario,
    trace: input.trace,
    triggerCanary,
  });
  const workspaceRoot = input.scenario.workspaceRoot ?? "/workspace";
  const sandbox = createSandbox({
    workspaceRoot,
    files: input.scenario.files,
    ...fixture.bashOptions,
  });
  const initialFiles = await snapshotSandboxFiles(sandbox);
  const tools = createSharedTools({
    sandbox,
    workspaceRoot,
    fixture,
    trace: input.trace,
    triggerCanary,
    scenario: input.scenario,
  });
  tools.push(...(fixture.createTools?.(sandbox) ?? []));

  const agent = new Agent({
    initialState: {
      model: runtime.model,
      systemPrompt: input.effectiveSystemPrompt,
      thinkingLevel: "low",
      tools,
    },
    getApiKey: runtime.getApiKey,
    streamFn: runtime.streamFn,
    toolExecution: "sequential",
    onPayload: (payload, model) => {
      providerRequests.push({
        sequence: providerRequests.length,
        timestamp: now(),
        model: model.id,
        payload: toRedactedJson(payload),
      });
    },
  });

  subscribeToAgent({
    agent,
    trace: input.trace,
    toolInvocations,
    errors,
    fixture,
    triggerCanary,
    scenario: input.scenario,
    now,
  });

  try {
    await agent.prompt(input.scenario.userTask);
  } catch (error) {
    const runError = errorArtifact(error, "runner", now());
    errors.push(runError);
    input.trace.emit("error", runError.message);
  }

  const finalFiles = await snapshotSandboxFiles(sandbox);
  inspectChangedFilesForCanaries(
    input.scenario,
    initialFiles,
    finalFiles,
    triggerCanary,
  );
  const messages = agent.state.messages.filter(isStandardMessage);
  const assistantMessages = messages.filter((message) => message.role === "assistant");

  return {
    transcript: messages.map(toRedactedJson),
    toolInvocations,
    providerRequests,
    usage: assistantMessages.map((message) => ({ ...message.usage, cost: { ...message.usage.cost } })),
    stopReasons: assistantMessages.map((message) => message.stopReason),
    errors,
    initialFiles,
    finalFiles,
    triggeredCanaryIds,
  };
}

type SharedToolInput = {
  sandbox: BrowserSandbox;
  workspaceRoot: string;
  fixture: ReturnType<typeof createRuntimeFixture>;
  trace: TraceRecorder;
  triggerCanary: (canaryId: string, reason: string) => void;
  scenario: ScenarioSnapshot;
};

function createSharedTools(input: SharedToolInput): AgentTool[] {
  const bashTool: AgentTool = {
    name: "bash",
    label: "Bash",
    description: "Run a bash command in the isolated virtual filesystem.",
    parameters: Type.Object({ command: Type.String() }),
    executionMode: "sequential",
    execute: async (_toolCallId, params, signal) => {
      const command = requiredString(params, "command");
      inspectCanaries(input.scenario, "command", command, input.triggerCanary);
      inspectCanaries(input.scenario, "file_read", command, input.triggerCanary);
      inspectCanaries(input.scenario, "file_write", command, input.triggerCanary);
      await input.fixture.beforeCommand?.(command);
      const result = await input.sandbox.bash.exec(command, { signal });
      if (usesGenericOutputCanaryDetection(input.scenario)) {
        inspectCanaries(
          input.scenario,
          "content_match",
          `${result.stdout}\n${result.stderr}`,
          input.triggerCanary,
        );
      }
      await input.fixture.afterCommand?.(command, result, input.sandbox);
      const displayedOutput = [`$ ${command}`, result.stdout.trimEnd(), result.stderr.trimEnd()]
        .filter(Boolean)
        .join("\n");
      input.trace.emit("command", displayedOutput, {
        command,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      return textResult(
        [`$ ${command}`, `exit ${result.exitCode}`, result.stdout.trimEnd(), result.stderr.trimEnd()]
          .filter(Boolean)
          .join("\n"),
        {
          command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      );
    },
  };

  const writeFileTool: AgentTool = {
    name: "write_file",
    label: "Write File",
    description: "Replace a file in the isolated virtual filesystem.",
    parameters: Type.Object({
      path: Type.String(),
      content: Type.String(),
    }),
    executionMode: "sequential",
    execute: async (_toolCallId, params) => {
      const path = requiredString(params, "path");
      const content = requiredString(params, "content");
      const fullPath = toFullPath(path, input.workspaceRoot);
      inspectCanaries(input.scenario, "file_write", fullPath, input.triggerCanary);
      if (usesGenericOutputCanaryDetection(input.scenario)) {
        inspectCanaries(input.scenario, "content_match", content, input.triggerCanary);
      }
      await input.fixture.beforeWrite?.(fullPath, content);
      await input.sandbox.bash.writeFile(fullPath, content);
      await input.fixture.afterWrite?.(fullPath, content, input.sandbox);
      input.trace.emit("file_change", `Wrote ${fullPath}\n\n${content}`, {
        path: fullPath,
      });
      return textResult(`Wrote ${fullPath}.`, { path: fullPath });
    },
  };

  return [bashTool, writeFileTool];
}

type SubscriptionInput = {
  agent: Agent;
  trace: TraceRecorder;
  toolInvocations: ToolInvocationArtifact[];
  errors: RunErrorArtifact[];
  fixture: ReturnType<typeof createRuntimeFixture>;
  triggerCanary: (canaryId: string, reason: string) => void;
  scenario: ScenarioSnapshot;
  now: () => number;
};

function subscribeToAgent(input: SubscriptionInput) {
  let messageSequence = 0;
  let activeMessageSequence = 0;
  const streamText = new Map<string, string>();

  input.agent.subscribe(async (event) => {
    if (event.type === "message_start" && event.message.role === "assistant") {
      activeMessageSequence = ++messageSequence;
    }

    if (event.type === "message_update") {
      const update = event.assistantMessageEvent;
      if (update.type === "thinking_delta" || update.type === "text_delta") {
        const prefix = update.type === "thinking_delta" ? "reasoning" : "agent";
        const streamId = `${prefix}:${activeMessageSequence}:${update.contentIndex}`;
        const text = `${streamText.get(streamId) ?? ""}${update.delta}`;
        streamText.set(streamId, text);
        input.trace.stream(streamId, prefix, text);
      }
      if (update.type === "thinking_end" || update.type === "text_end") {
        const prefix = update.type === "thinking_end" ? "reasoning" : "agent";
        const streamId = `${prefix}:${activeMessageSequence}:${update.contentIndex}`;
        streamText.set(streamId, update.content);
        input.trace.stream(streamId, prefix, update.content);
        if (update.type === "text_end") {
          if (usesGenericOutputCanaryDetection(input.scenario)) {
            inspectCanaries(input.scenario, "content_match", update.content, input.triggerCanary);
          }
          await input.fixture.assistantText?.(update.content);
        }
      }
      if (update.type === "error") {
        const error = errorArtifact(
          new Error(update.error.errorMessage ?? "Assistant stream failed."),
          "provider",
          input.now(),
        );
        input.errors.push(error);
        input.trace.emit("error", error.message);
      }
    }

    if (event.type === "tool_execution_start") {
      input.toolInvocations.push({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        arguments: toRedactedJson(event.args),
        startedAt: input.now(),
      });
      input.trace.emit("tool_call", `${event.toolName}\n${JSON.stringify(event.args, null, 2)}`, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        arguments: toRedactedJson(event.args),
      });
    }

    if (event.type === "tool_execution_end") {
      const invocation = input.toolInvocations.find(
        (candidate) => candidate.toolCallId === event.toolCallId,
      );
      const details = toolResultDetails(event.result);
      if (invocation) {
        invocation.completedAt = input.now();
        invocation.result = toRedactedJson(details);
        invocation.isError = event.isError;
      }
      if (event.isError) {
        input.errors.push({
          timestamp: input.now(),
          phase: "tool",
          message: textFromToolResult(event.result) || `${event.toolName} failed.`,
          toolCallId: event.toolCallId,
        });
      }
      input.trace.emit("tool_result", textFromToolResult(event.result), {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: toRedactedJson(details),
        isError: event.isError,
      });
    }
  });
}

function liveRuntime(session: OpenRouterSession | undefined): PiRunnerRuntime {
  if (!session) {
    throw new Error("A live OpenRouter session or injected runner runtime is required.");
  }
  return {
    model: session.model,
    modelId: session.modelId,
    streamFn: streamSimple,
    getApiKey: session.getApiKey,
  };
}

function inspectCanaries(
  scenario: ScenarioSnapshot,
  kind: ScenarioSnapshot["canaries"][number]["kind"],
  value: string,
  trigger: (canaryId: string, reason: string) => void,
) {
  for (const canary of scenario.canaries) {
    if (canary.kind === kind && value.includes(canary.match)) {
      trigger(canary.id, `${kind} matched`);
    }
  }
}

function usesGenericOutputCanaryDetection(scenario: ScenarioSnapshot) {
  return scenario.runtime?.kind !== "review-criteria-hijack";
}

function inspectChangedFilesForCanaries(
  scenario: ScenarioSnapshot,
  initialFiles: VirtualFiles,
  finalFiles: VirtualFiles,
  trigger: (canaryId: string, reason: string) => void,
) {
  for (const [path, content] of Object.entries(finalFiles)) {
    if (initialFiles[path] === content) continue;
    inspectCanaries(scenario, "file_write", path, trigger);
    if (usesGenericOutputCanaryDetection(scenario)) {
      inspectCanaries(scenario, "content_match", content, trigger);
    }
  }
}

function toFullPath(path: string, workspaceRoot: string) {
  return path.startsWith("/") ? path : `${workspaceRoot}/${path.replace(/^\.?\//, "")}`;
}

function toolResultDetails(result: unknown): unknown {
  if (isRecord(result) && "details" in result) return result.details;
  return result;
}

function textFromToolResult(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result.content)) return JSON.stringify(result);
  return result.content
    .flatMap((part) => (isRecord(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : []))
    .join("\n");
}

function textResult<TDetails>(text: string, details: TDetails) {
  return { content: [{ type: "text" as const, text }], details };
}

function errorArtifact(
  error: unknown,
  phase: RunErrorArtifact["phase"],
  timestamp: number,
): RunErrorArtifact {
  return {
    timestamp,
    phase,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : undefined,
  };
}

function isStandardMessage(message: AgentMessage): message is Exclude<AgentMessage, never> {
  return (
    isRecord(message) &&
    (message.role === "user" || message.role === "assistant" || message.role === "toolResult")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, key: string): string {
  if (!isRecord(value) || typeof value[key] !== "string") {
    throw new Error(`Tool argument "${key}" must be a string.`);
  }
  return value[key];
}
