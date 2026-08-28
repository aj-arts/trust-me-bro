import type { ScenarioSnapshot } from "../browser-runner/scenarioSnapshot.ts";
import type { RunArtifact } from "../browser-runner/types.ts";
import type { PromptSnapshot } from "../experiment-store/core.ts";

export type OptimizationMode = "red-team" | "blue-team";

export const MUTATION_CATEGORIES = [
  "instruction-obfuscation",
  "context-placement",
  "fixture-content",
  "task-clarity",
  "safety-policy",
  "scope-control",
  "refusal-calibration",
  "cost-reduction",
] as const;

export type MutationCategory = (typeof MUTATION_CATEGORIES)[number];

export const MUTATION_CATEGORIES_BY_MODE = {
  "red-team": [
    "instruction-obfuscation",
    "context-placement",
    "fixture-content",
    "task-clarity",
  ],
  "blue-team": [
    "safety-policy",
    "scope-control",
    "refusal-calibration",
    "cost-reduction",
  ],
} as const satisfies Record<OptimizationMode, readonly MutationCategory[]>;

export type ScoreVector = {
  hardSafety: number;
  hardTaskSuccess: number;
  attackSuccess: number;
  subtlety: number;
  unnecessaryRefusal: number;
  costUsd: number;
  totalTokens: number;
};

export type ScoredRun = {
  runId: string;
  vector: ScoreVector;
  scalar: number;
};

export type AggregateScore = {
  mode: OptimizationMode;
  runs: ScoredRun[];
  mean: ScoreVector;
  variance: ScoreVector;
  scalarMean: number;
  scalarVariance: number;
};

export type ScenarioSetOperation =
  | {
      op: "set";
      path: "/title" | "/description" | "/userTask";
      value: string;
    }
  | {
      op: "set";
      path: `/files/${string}`;
      value: string;
    }
  | {
      op: "delete";
      path: `/files/${string}`;
    };

export type PromptSetOperation = {
  op: "set";
  path: "/systemPrompt";
  value: string;
};

export type MutationBudgetUsage = {
  operations: number;
  filesTouched: number;
  bytesAdded: number;
  estimatedEditDistance: number;
};

export type StructuredProposal = {
  schemaVersion: 1;
  mode: OptimizationMode;
  category: MutationCategory;
  parentScenarioRevisionId: string;
  parentPromptRevisionId: string;
  operations: Array<ScenarioSetOperation | PromptSetOperation>;
  rationale: string;
  expectedBehavioralChange: string;
  budgetUsage: MutationBudgetUsage;
};

export type ProposalDraft = Omit<StructuredProposal, "budgetUsage"> & {
  budgetUsage?: MutationBudgetUsage;
};

export type ProposalValidationIssue = {
  path: string;
  code:
    | "invalid_json"
    | "invalid_schema"
    | "unknown_field"
    | "invalid_parent"
    | "wrong_surface"
    | "invalid_path"
    | "protected_field"
    | "unsupported_runtime"
    | "limit_exceeded"
    | "budget_mismatch";
  message: string;
};

export class ProposalValidationError extends Error {
  readonly issues: ProposalValidationIssue[];
  readonly proposal?: StructuredProposal;

  constructor(
    message: string,
    issues: ProposalValidationIssue[],
    proposal?: StructuredProposal,
  ) {
    super(message);
    this.name = "ProposalValidationError";
    this.issues = issues;
    this.proposal = proposal;
  }
}

export type ProposalLimits = {
  maxOperations: number;
  maxFilesTouched: number;
  maxOperationValueBytes: number;
  maxTotalValueBytes: number;
  maxScenarioFiles: number;
  maxScenarioBytes: number;
  maxPromptBytes: number;
  maxEditDistance: number;
  maxEditRatio: number;
};

export const DEFAULT_PROPOSAL_LIMITS: ProposalLimits = {
  maxOperations: 6,
  maxFilesTouched: 3,
  maxOperationValueBytes: 32 * 1024,
  maxTotalValueBytes: 64 * 1024,
  maxScenarioFiles: 64,
  maxScenarioBytes: 256 * 1024,
  maxPromptBytes: 32 * 1024,
  maxEditDistance: 4_000,
  maxEditRatio: 0.4,
};

export const DEFAULT_BLUE_PROPOSAL_LIMITS: ProposalLimits = {
  ...DEFAULT_PROPOSAL_LIMITS,
  maxEditRatio: 2,
};

export function proposalLimitsForMode(
  mode: OptimizationMode,
  configured?: ProposalLimits,
) {
  return configured ?? (mode === "blue-team" ? DEFAULT_BLUE_PROPOSAL_LIMITS : DEFAULT_PROPOSAL_LIMITS);
}

export type ProposalRequest = {
  mode: OptimizationMode;
  objective: string;
  scenario: ScenarioSnapshot;
  prompt: PromptSnapshot;
  promptRevisionId: string;
  limits: ProposalLimits;
  maxTokens: number;
  signal?: AbortSignal;
};

export type ProposalResponse = {
  output: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export interface ProposalGenerator {
  readonly modelId: string;
  generate(request: ProposalRequest): Promise<ProposalResponse>;
}

export type EvaluatedAgentRequest = {
  runId: string;
  scenario: ScenarioSnapshot;
  prompt: PromptSnapshot;
  modelId: string;
  maxTokens: number;
  signal?: AbortSignal;
};

export interface EvaluatedAgent {
  run(request: EvaluatedAgentRequest): Promise<RunArtifact>;
}

export type OptimizerLimits = {
  maxIterations: number;
  maxCandidates: number;
  repeats: number;
  maxEvaluatedRuns: number;
  maxConcurrentRuns: 1;
  maxProposalTokens: number;
  maxTokensPerProposal: number;
  maxEvaluatedAgentTokens: number;
  maxTokensPerEvaluatedRun: number;
  maxReservedTokensPerEvaluatedRun: number;
  maxEstimatedSpendUsd: number;
  estimatedProposalCostUsd: number;
  estimatedEvaluatedRunCostUsd: number;
};

export const DEFAULT_OPTIMIZER_LIMITS: OptimizerLimits = {
  maxIterations: 1,
  maxCandidates: 1,
  repeats: 1,
  maxEvaluatedRuns: 2,
  maxConcurrentRuns: 1,
  maxProposalTokens: 131_072,
  maxTokensPerProposal: 131_072,
  maxEvaluatedAgentTokens: 2_097_152,
  maxTokensPerEvaluatedRun: 131_072,
  maxReservedTokensPerEvaluatedRun: 1_048_576,
  maxEstimatedSpendUsd: 25,
  estimatedProposalCostUsd: 0.02,
  estimatedEvaluatedRunCostUsd: 0.04,
};

export type BudgetSnapshot = {
  consumed: {
    iterations: number;
    candidates: number;
    evaluatedRuns: number;
    proposalTokens: number;
    evaluatedAgentTokens: number;
    estimatedSpendUsd: number;
  };
  remaining: BudgetSnapshot["consumed"];
  limits: OptimizerLimits;
};

export type OptimizerPhase =
  | "loading"
  | "waiting"
  | "baseline"
  | "proposing"
  | "validating"
  | "running-candidate"
  | "evaluating"
  | "deciding"
  | "completed"
  | "cancelled"
  | "failed";

export type OptimizerProgress = {
  phase: OptimizerPhase;
  iteration: number;
  message: string;
  budget: BudgetSnapshot;
  candidateId?: string;
  proposal?: StructuredProposal;
  validationIssues?: ProposalValidationIssue[];
  baseline?: AggregateScore;
  candidate?: AggregateScore;
  decision?: "accepted" | "rejected";
};

export type OptimizerSeed = {
  scenario: ScenarioSnapshot;
  prompt: PromptSnapshot;
  promptRevisionId: string;
};

export type HoldoutConfiguration = {
  evaluatedModelId: string;
};

export type OptimizerConfiguration = {
  experimentId: string;
  mode: OptimizationMode;
  objective: string;
  proposalModelId: string;
  evaluatedModelId: string;
  limits: OptimizerLimits;
  proposalLimits?: ProposalLimits;
  holdout?: HoldoutConfiguration;
};
