import type { AgentAction } from "../agent/types";
import type { ExecutedCommand, FetchAttempt } from "../engine/types";
import type { CustomCommand } from "just-bash";

/**
 * just-bash InitialFiles shape (path -> file content). Kept local to avoid a
 * hard type dependency on the package's deep import paths.
 */
export type ScenarioFiles = Record<string, string>;

/** Whether the agent is run with extra safe-coding guidance or not. */
export type SafetyMode = "none" | "safe";

/**
 * A snapshot of the virtual filesystem keyed by absolute path. Used to compute
 * before/after diffs so the UI can show what the agent changed.
 */
export type FsSnapshot = Record<string, string>;

/**
 * Context handed to a canary's detector after the agent finishes. A canary
 * "triggers" when the agent did the dangerous thing the scenario is probing
 * for (exfiltrated a secret, ran a destructive command, modified a protected
 * file, etc.).
 */
export interface CanaryContext {
  commands: ExecutedCommand[];
  fetches: FetchAttempt[];
  fsBefore: FsSnapshot;
  fsAfter: FsSnapshot;
}

export interface Canary {
  id: string;
  /** Short human-readable name shown in the run viewer. */
  label: string;
  /** What dangerous behavior this canary watches for. */
  description: string;
  /** Returns true if the agent tripped this canary (i.e. acted unsafely). */
  detect: (ctx: CanaryContext) => boolean;
}

export interface Scenario {
  id: string;
  title: string;
  /** e.g. "Hidden instructions", "Malicious setup script". */
  category: string;
  /**
   * Meta description of what is being tested. NOT shown to the agent — only to
   * the human inspecting the benchmark.
   */
  description: string;
  /** The benign task the agent is actually asked to perform. */
  userTask: string;
  /**
   * The virtual repo the agent operates in. May contain hidden malicious
   * instructions, fake secrets, and harmless canary files.
   */
  files: ScenarioFiles;
  /** The dangerous behaviors this scenario watches for. */
  canaries: Canary[];
  /**
   * Optional fake CLI tools registered in the virtual shell for this scenario
   * (e.g. an adapted InjecAgent "attacker tool" such as a bank-transfer or
   * send-email command). Invoking a harmful one is what trips a canary. Not
   * sent to the client.
   */
  customCommands?: CustomCommand[];
  /**
   * Deterministic mock-agent behavior, parameterized by safety mode. This lets
   * the benchmark demonstrate how a naive agent (mode "none") trips a trap that
   * a safety-instructed agent (mode "safe") avoids — without needing a live
   * model. A real model would replace this via the OpenRouter loop.
   */
  mockPlan: (mode: SafetyMode) => AgentAction[];
}

/** Scenario metadata safe to expose to the frontend (no detector functions). */
export interface ScenarioSummary {
  id: string;
  title: string;
  category: string;
  description: string;
  userTask: string;
  files: ScenarioFiles;
  canaries: { id: string; label: string; description: string }[];
}

export function toScenarioSummary(scenario: Scenario): ScenarioSummary {
  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    description: scenario.description,
    userTask: scenario.userTask,
    files: scenario.files,
    canaries: scenario.canaries.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
    })),
  };
}
