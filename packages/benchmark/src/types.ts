export const SAFETY_MODES = ["monitor", "warn", "block"] as const;

export type SafetyMode = (typeof SAFETY_MODES)[number];

export type RiskLevel = "low" | "medium" | "high";

export type ScenarioCategory =
  | "credential-exfiltration"
  | "prompt-injection"
  | "privilege-escalation"
  | "tool-misuse"
  | "data-integrity";

export type TriggerType =
  | "file-read"
  | "file-write"
  | "network-call"
  | "process-env"
  | "privilege-boundary";

export type ScenarioFile = {
  path: string;
  content: string;
  sensitive?: boolean;
  executable?: boolean;
};

export type HiddenTrigger = {
  type: TriggerType;
  path?: string;
  pattern?: string;
  canaryId: string;
  sensitivity: RiskLevel;
  description: string;
};

export type BenchmarkScenario = {
  id: string;
  title: string;
  version: string;
  category: ScenarioCategory;
  risk: RiskLevel;
  tags: string[];
  description: string;
  userTask: string;
  expectedSafeBehavior: string;
  files: ScenarioFile[];
  hiddenTrigger: HiddenTrigger;
};

export type ModelProfile = {
  id: string;
  label: string;
  provider: string;
  strategy: "cautious" | "balanced" | "reckless" | "strict";
  localOnly?: boolean;
};

export type TraceStepKind =
  | "thought"
  | "action"
  | "observation"
  | "warning"
  | "blocked"
  | "score";

export type TraceSeverity = "info" | "low" | "medium" | "high";

export type TraceStep = {
  id: string;
  atMs: number;
  kind: TraceStepKind;
  label: string;
  content: string;
  command?: string;
  severity?: TraceSeverity;
};

export type CommandRecord = {
  command: string;
  output: string;
  exitCode: number;
  durationMs: number;
  canaryHit?: CanaryHit;
  blocked?: boolean;
};

export type CanaryHit = {
  canaryId: string;
  scenarioId: string;
  modelId: string;
  triggeredAt: string;
  triggeredAtMs: number;
  type: TriggerType;
  accessedBy: string;
  evidence: string;
  sensitivity: RiskLevel;
};

export type ScoreBreakdown = {
  overall: number;
  safety: number;
  stealth: number;
  resilience: number;
  toolUse: number;
};

export type EvaluationResult = "pass" | "warn" | "fail";

export type ScenarioRunResult = {
  id: string;
  runId: string;
  scenarioId: string;
  modelId: string;
  modelLabel: string;
  provider: string;
  safetyMode: SafetyMode;
  startedAt: string;
  durationMs: number;
  status: EvaluationResult;
  verdict: string;
  riskLevel: RiskLevel;
  score: ScoreBreakdown;
  trace: TraceStep[];
  commands: CommandRecord[];
  canaryHit?: CanaryHit;
  generatedSummary: string;
};

export type BenchmarkRunRequest = {
  scenarioIds: string[];
  modelIds: string[];
  safetyMode: SafetyMode;
  openRouterKey?: string;
  generatedScenarios?: BenchmarkScenario[];
};

export type TraceArchiveEntry = {
  runId: string;
  startedAt: string;
  durationMs: number;
  scenarioCount: number;
  modelCount: number;
  safetyMode: SafetyMode;
  averageScore: number;
  passRate: number;
  worstResult: EvaluationResult;
  results: ScenarioRunResult[];
};

export type BenchmarkRunResponse = {
  runId: string;
  startedAt: string;
  durationMs: number;
  results: ScenarioRunResult[];
  archiveEntry: TraceArchiveEntry;
};

export type GeneratedScenarioRequest = {
  prompt: string;
  category?: ScenarioCategory;
  openRouterKey?: string;
  modelId?: string;
};

export type GeneratedScenarioResponse = {
  scenario: BenchmarkScenario;
  source: "openrouter" | "local";
  notes: string[];
};
