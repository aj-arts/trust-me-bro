import { Bash } from "just-bash";
import type { SecureFetch } from "just-bash";
import { runAgentLoop } from "../agent/loop";
import { ScriptedModel } from "../agent/scriptedModel";
import { OpenRouterModel } from "../agent/openrouter";
import type { AgentModel } from "../agent/types";
import type { Scenario, SafetyMode } from "../scenarios/types";
import { diffSnapshots, snapshotFs } from "./fsSnapshot";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import type {
  CanaryResult,
  FetchAttempt,
  RunResult,
  Verdict,
} from "./types";

export interface RunOptions {
  scenario: Scenario;
  safetyMode: SafetyMode;
  /** Optional live model config. When omitted, the deterministic mock runs. */
  openRouter?: { apiKey: string; model: string };
  maxSteps?: number;
}

/** Paths that belong to just-bash's default layout, not the scenario repo. */
const SYSTEM_PREFIXES = ["/bin", "/usr", "/sbin", "/etc", "/proc", "/sys", "/dev", "/var", "/lib", "/opt"];

function isSystemPath(path: string): boolean {
  if (path === "/home/user/.keep") return true; // seed file, not part of the repo
  return SYSTEM_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Execute one scenario against one model under one safety mode.
 *
 * The network layer is wired to a recording hook: any request the agent makes
 * (e.g. `curl`) is captured as a FetchAttempt and answered with a harmless
 * canned response — no real network traffic ever leaves the process. This is
 * what lets the "exfiltration" canaries fire without running real malware.
 */
export async function runScenario(options: RunOptions): Promise<RunResult> {
  const { scenario, safetyMode } = options;
  const fetches: FetchAttempt[] = [];
  const stepRef = { current: 0 };

  const recordingFetch: SecureFetch = async (url, init) => {
    fetches.push({
      step: stepRef.current,
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" },
      body: new TextEncoder().encode("ok\n"),
      url,
    };
  };

  const bash = new Bash({
    files: { "/home/user/.keep": "", ...scenario.files },
    env: { HOME: "/home/user", USER: "user", PWD: "/home/user" },
    cwd: "/home/user",
    fetch: recordingFetch,
    // just-bash enables defense-in-depth by default, which monkey-patches host
    // globals (performance, process.env, …) during exec to harden against JS
    // sandbox escapes. We never run untrusted JS/Python here (only plain bash),
    // and that patching collides with Next.js dev-mode async-hooks
    // instrumentation that reads performance.now()/process.env mid-exec. Disable
    // it so the benchmark runs under `next dev`.
    defenseInDepth: false,
    customCommands: scenario.customCommands,
  });

  const fsBefore = await snapshotFs(bash);

  const model: AgentModel = options.openRouter
    ? new OpenRouterModel({
        apiKey: options.openRouter.apiKey,
        model: options.openRouter.model,
      })
    : new ScriptedModel(`mock:${scenario.id}`, scenario.mockPlan(safetyMode));

  const systemPrompt = buildSystemPrompt(safetyMode);
  const userPrompt = buildUserPrompt(scenario.userTask, scenario.files);

  const loop = await runAgentLoop(bash, model, {
    systemPrompt,
    userPrompt,
    maxSteps: options.maxSteps,
    stepRef,
  });

  const fsAfter = await snapshotFs(bash);
  const fsChanges = diffSnapshots(fsBefore, fsAfter).filter(
    (c) => !isSystemPath(c.path),
  );

  const canaries: CanaryResult[] = scenario.canaries.map((canary) => ({
    id: canary.id,
    label: canary.label,
    description: canary.description,
    triggered: canary.detect({
      commands: loop.commands,
      fetches,
      fsBefore,
      fsAfter,
    }),
  }));

  const verdict: Verdict = canaries.some((c) => c.triggered)
    ? "compromised"
    : "safe";

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(fsAfter)) {
    if (!isSystemPath(path)) files[path] = content;
  }

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    category: scenario.category,
    modelId: model.id,
    safetyMode,
    userTask: scenario.userTask,
    systemPrompt,
    turns: loop.commands,
    fetches,
    fsChanges,
    files,
    finalMessage: loop.finalMessage,
    steps: loop.steps,
    stoppedReason: loop.stoppedReason,
    canaries,
    verdict,
  };
}
