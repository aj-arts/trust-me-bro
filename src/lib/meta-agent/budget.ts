import {
  DEFAULT_OPTIMIZER_LIMITS,
  type BudgetSnapshot,
  type OptimizerLimits,
} from "./types.ts";

type Consumption = BudgetSnapshot["consumed"];

export class OptimizerBudget {
  readonly limits: OptimizerLimits;
  private consumed: Consumption;

  constructor(limits: OptimizerLimits = DEFAULT_OPTIMIZER_LIMITS, consumed?: Partial<Consumption>) {
    validateLimits(limits);
    this.limits = { ...limits };
    this.consumed = {
      iterations: 0,
      candidates: 0,
      evaluatedRuns: 0,
      proposalTokens: 0,
      evaluatedAgentTokens: 0,
      estimatedSpendUsd: 0,
      ...consumed,
    };
    this.assertWithinLimits();
  }

  assertCanPropose() {
    this.assertAdditional({
      iterations: 1,
      candidates: 1,
      estimatedSpendUsd: this.limits.estimatedProposalCostUsd,
    });
    if (this.snapshot().remaining.proposalTokens < 1) {
      throw new Error("Optimizer budget exhausted: proposalTokens has no remaining capacity.");
    }
  }

  assertCanProposeAndRun(runCount: number) {
    this.assertAdditional({
      iterations: 1,
      candidates: 1,
      evaluatedRuns: runCount,
      evaluatedAgentTokens: runCount * this.limits.maxReservedTokensPerEvaluatedRun,
      estimatedSpendUsd:
        this.limits.estimatedProposalCostUsd +
        runCount * this.limits.estimatedEvaluatedRunCostUsd,
    });
    if (this.snapshot().remaining.proposalTokens < 1) {
      throw new Error("Optimizer budget exhausted: proposalTokens has no remaining capacity.");
    }
  }

  proposalTokenAllowance() {
    this.assertCanPropose();
    return Math.min(
      this.limits.maxTokensPerProposal,
      Math.floor(this.snapshot().remaining.proposalTokens),
    );
  }

  consumeProposal(tokens: number, costUsd: number) {
    this.add({
      iterations: 1,
      candidates: 1,
      proposalTokens: tokens,
      estimatedSpendUsd: costUsd,
    });
  }

  assertCanRun(count = 1) {
    this.assertAdditional({
      evaluatedRuns: count,
      evaluatedAgentTokens: count * this.limits.maxReservedTokensPerEvaluatedRun,
      estimatedSpendUsd: count * this.limits.estimatedEvaluatedRunCostUsd,
    });
  }

  consumeRun(tokens: number, costUsd: number) {
    this.add({
      evaluatedRuns: 1,
      evaluatedAgentTokens: tokens,
      estimatedSpendUsd: costUsd,
    });
  }

  snapshot(): BudgetSnapshot {
    return {
      consumed: { ...this.consumed },
      remaining: {
        iterations: Math.max(0, this.limits.maxIterations - this.consumed.iterations),
        candidates: Math.max(0, this.limits.maxCandidates - this.consumed.candidates),
        evaluatedRuns: Math.max(0, this.limits.maxEvaluatedRuns - this.consumed.evaluatedRuns),
        proposalTokens: Math.max(0, this.limits.maxProposalTokens - this.consumed.proposalTokens),
        evaluatedAgentTokens: Math.max(
          0,
          this.limits.maxEvaluatedAgentTokens - this.consumed.evaluatedAgentTokens,
        ),
        estimatedSpendUsd: Math.max(
          0,
          this.limits.maxEstimatedSpendUsd - this.consumed.estimatedSpendUsd,
        ),
      },
      limits: { ...this.limits },
    };
  }

  private assertAdditional(additional: Partial<Consumption>) {
    const next = mergeConsumption(this.consumed, additional);
    assertConsumption(next, this.limits);
  }

  private add(additional: Partial<Consumption>) {
    const next = mergeConsumption(this.consumed, additional);
    assertConsumption(next, this.limits);
    this.consumed = next;
  }

  private assertWithinLimits() {
    assertConsumption(this.consumed, this.limits);
  }
}

function validateLimits(limits: OptimizerLimits) {
  const integerFields: Array<keyof OptimizerLimits> = [
    "maxIterations",
    "maxCandidates",
    "repeats",
    "maxEvaluatedRuns",
    "maxConcurrentRuns",
    "maxProposalTokens",
    "maxTokensPerProposal",
    "maxEvaluatedAgentTokens",
    "maxTokensPerEvaluatedRun",
    "maxReservedTokensPerEvaluatedRun",
  ];
  for (const field of integerFields) {
    if (!Number.isInteger(limits[field]) || limits[field] <= 0) {
      throw new Error(`${field} must be a positive integer.`);
    }
    if (limits.maxIterations > 25 || limits.maxCandidates > 25) {
      throw new Error("Optimizer iterations and candidates are capped at 25.");
    }
    if (limits.maxEvaluatedRuns > 100) {
      throw new Error("Optimizer evaluated runs are capped at 100 for resumable history.");
    }
  }
  if (limits.maxConcurrentRuns !== 1) {
    throw new Error("Only sequential evaluated runs are supported.");
  }
  if (limits.maxReservedTokensPerEvaluatedRun < limits.maxTokensPerEvaluatedRun) {
    throw new Error("Evaluated-run token reservation cannot be smaller than its output-token cap.");
  }
  for (const field of [
    "maxEstimatedSpendUsd",
    "estimatedProposalCostUsd",
    "estimatedEvaluatedRunCostUsd",
  ] as const) {
    if (!Number.isFinite(limits[field]) || limits[field] < 0) {
      throw new Error(`${field} must be a non-negative finite number.`);
    }
  }
}

function mergeConsumption(current: Consumption, additional: Partial<Consumption>): Consumption {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      value + (additional[key as keyof Consumption] ?? 0),
    ]),
  ) as Consumption;
}

function assertConsumption(consumed: Consumption, limits: OptimizerLimits) {
  const checks: Array<[keyof Consumption, number]> = [
    ["iterations", limits.maxIterations],
    ["candidates", limits.maxCandidates],
    ["evaluatedRuns", limits.maxEvaluatedRuns],
    ["proposalTokens", limits.maxProposalTokens],
    ["evaluatedAgentTokens", limits.maxEvaluatedAgentTokens],
    ["estimatedSpendUsd", limits.maxEstimatedSpendUsd],
  ];
  for (const [field, maximum] of checks) {
    if (consumed[field] > maximum + Number.EPSILON) {
      throw new Error(`Optimizer budget exhausted: ${field} would exceed ${maximum}.`);
    }
  }
}
