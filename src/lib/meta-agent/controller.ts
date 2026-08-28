import type { RunArtifact } from "../browser-runner/types.ts";
import { stableStringify } from "../browser-runner/scenarioSnapshot.ts";
import {
  OptimizerLeaseConflictError,
  type ExperimentRepository,
  type StoredRunSummary,
} from "../experiment-store/repository.ts";
import { OptimizerBudget } from "./budget.ts";
import { parseStructuredProposal } from "./proposal.ts";
import { aggregateScores, compareAggregates, scoreArtifact } from "./scoring.ts";
import {
  ProposalValidationError,
  proposalLimitsForMode,
  type AggregateScore,
  type EvaluatedAgent,
  type OptimizerConfiguration,
  type OptimizerProgress,
  type OptimizerSeed,
  type ProposalGenerator,
  type StructuredProposal,
} from "./types.ts";
import { validateAndApplyProposal } from "./validation.ts";

export type OptimizerControllerInput = {
  repository: ExperimentRepository;
  proposer: ProposalGenerator;
  evaluatedAgent: EvaluatedAgent;
  configuration: OptimizerConfiguration;
  seed: OptimizerSeed;
  signal?: AbortSignal;
  onProgress?: (progress: OptimizerProgress) => void;
};

export async function createOptimizerExperiment(input: {
  repository: ExperimentRepository;
  experimentId: string;
  name: string;
  objective: string;
  seed: Omit<OptimizerSeed, "promptRevisionId">;
}) {
  const scenarioRevision = await input.repository.createScenarioRevision(input.seed.scenario);
  const promptRevision = await input.repository.createPromptRevision(
    input.seed.prompt.systemPrompt,
    input.seed.prompt.systemPromptMode,
  );
  await input.repository.createExperiment({
    experimentId: input.experimentId,
    name: input.name,
    objective: input.objective,
    scenarioRevisionId: scenarioRevision.revisionId,
    promptRevisionId: promptRevision.revisionId,
  });
  return {
    scenario: scenarioRevision.snapshot,
    prompt: promptRevision.snapshot,
    promptRevisionId: promptRevision.revisionId,
  } satisfies OptimizerSeed;
}

export async function runOptimizer(input: OptimizerControllerInput): Promise<OptimizerProgress> {
  const { repository, configuration } = input;
  new OptimizerBudget(configuration.limits);
  const proposalLimits = proposalLimitsForMode(
    configuration.mode,
    configuration.proposalLimits,
  );
  let detail = await repository.loadExperiment(configuration.experimentId);
  assertCompleteHistory(detail);
  assertExperimentSeed(detail, input);
  const configurationJson = stableStringify({ ...configuration, proposalLimits });
  await repository.bindOptimizerConfiguration(configuration.experimentId, configurationJson);
  detail = await repository.loadExperiment(configuration.experimentId);
  assertCompleteHistory(detail);
  if (detail.experiment.configurationJson !== configurationJson) {
    throw new Error("Optimizer configuration does not match the persisted experiment.");
  }
  let unresolvedProposalAttemptId: string | undefined;
  if (detail.experiment.proposalReservation) {
    const reservedCandidate = detail.candidates.find(
      (candidate) => candidate.candidateId === detail.experiment.proposalReservation?.candidateId,
    );
    if (!reservedCandidate) {
      unresolvedProposalAttemptId = detail.experiment.proposalReservation.attemptId;
    } else {
      await repository.completeProposalAttempt(
        configuration.experimentId,
        detail.experiment.proposalReservation.attemptId,
      );
      detail = await repository.loadExperiment(configuration.experimentId);
      assertCompleteHistory(detail);
    }
  }
  const budget = await reconstructBudget(repository, detail.runs, detail.candidates, configuration);
  const emit = (
    phase: OptimizerProgress["phase"],
    iteration: number,
    message: string,
    extras: Partial<OptimizerProgress> = {},
  ) => {
    const progress: OptimizerProgress = {
      phase,
      iteration,
      message,
      budget: budget.snapshot(),
      ...extras,
    };
    input.onProgress?.(progress);
    return progress;
  };
  if (unresolvedProposalAttemptId) {
    return emit(
      "waiting",
      detail.candidates.length,
      `Proposal attempt ${unresolvedProposalAttemptId} may have incurred cost; refusing duplicate inference.`,
    );
  }

  try {
    if (detail.experiment.status === "draft") {
      await repository.startExperiment(configuration.experimentId);
      detail = await repository.loadExperiment(configuration.experimentId);
      assertCompleteHistory(detail);
    } else if (detail.experiment.status !== "running") {
      return emit(
        detail.experiment.status === "cancelled" ? "cancelled" : detail.experiment.status === "failed" ? "failed" : "completed",
        detail.candidates.length,
        `Experiment is already ${detail.experiment.status}.`,
      );
    }
    abortIfRequested(input.signal);
    let seed = input.seed;
    const baselineArtifacts = await ensureRunSet({
      input,
      budget,
      seed,
      candidateId: undefined,
      iteration: 0,
      label: "baseline",
      existingRuns: detail.runs,
      revisionParents: undefined,
      emit,
    });
    abortIfRequested(input.signal);
    let baseline = aggregate(
      baselineArtifacts,
      configuration.mode,
      1,
    );
    emit("baseline", 0, "Baseline established.", { baseline });

    const iterationLimit = Math.min(
      configuration.limits.maxIterations,
      configuration.limits.maxCandidates,
    );
    let lastDecision: "accepted" | "rejected" | undefined;
    let lastProposal: StructuredProposal | undefined;
    let lastValidationIssues: ProposalValidationError["issues"] | undefined;
    for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
      abortIfRequested(input.signal);
      detail = await repository.loadExperiment(configuration.experimentId);
      assertCompleteHistory(detail);
      const candidateId = stableCandidateId(configuration.experimentId, iteration);
      const existing = detail.candidates.find((candidate) => candidate.candidateId === candidateId);
      if (existing?.validationIssuesJson) {
        const validationIssues = parseValidationIssues(existing.validationIssuesJson);
        const persistedProposal = existing.proposalJson
          ? parseStructuredProposal(existing.proposalJson)
          : undefined;
        lastProposal =
          persistedProposal?.budgetUsage
            ? { ...persistedProposal, budgetUsage: persistedProposal.budgetUsage }
            : undefined;
        lastValidationIssues = validationIssues;
        emit("deciding", iteration + 1, "Candidate rejected by mutation safety validation.", {
          candidateId,
          validationIssues,
          decision: "rejected",
        });
        lastDecision = "rejected";
        continue;
      }
      let proposal: StructuredProposal;
      let mutated: ReturnType<typeof validateAndApplyProposal>;
      if (existing) {
        if (!existing.proposalJson) throw new Error(`Candidate ${candidateId} has no persisted proposal.`);
        mutated = validateAndApplyProposal({
          proposal: parseStructuredProposal(existing.proposalJson),
          scenario: seed.scenario,
          prompt: seed.prompt,
          promptRevisionId: seed.promptRevisionId,
          limits: proposalLimits,
        });
        proposal = mutated.proposal;
        lastProposal = proposal;
        lastValidationIssues = undefined;
      } else {
        const candidateRunCount = expectedRunCount(configuration);
        budget.assertCanProposeAndRun(candidateRunCount);
        emit("proposing", iteration + 1, "Requesting one bounded proposal.");
        const proposalAttemptId = createAttemptId();
        await repository.reserveProposalAttempt({
          experimentId: configuration.experimentId,
          attemptId: proposalAttemptId,
          candidateId,
          modelId: input.proposer.modelId,
          maxTokens: budget.proposalTokenAllowance(),
          estimatedCostUsd: configuration.limits.estimatedProposalCostUsd,
        });
        const response = await input.proposer.generate({
          mode: configuration.mode,
          objective: configuration.objective,
          scenario: seed.scenario,
          prompt: seed.prompt,
          promptRevisionId: seed.promptRevisionId,
          limits: proposalLimits,
          maxTokens: budget.proposalTokenAllowance(),
          signal: input.signal,
        });
        budget.consumeProposal(response.outputTokens, response.costUsd);
        const draft = parseStructuredProposal(response.output);
        try {
          mutated = validateAndApplyProposal({
            proposal: draft,
            scenario: seed.scenario,
            prompt: seed.prompt,
            promptRevisionId: seed.promptRevisionId,
            limits: proposalLimits,
          });
        } catch (error) {
          if (!(error instanceof ProposalValidationError) || !error.proposal) throw error;
          const parentCandidateId = detail.candidates
            .filter((candidate) => candidate.status === "accepted")
            .at(-1)?.candidateId;
          await repository.createRejectedCandidate({
            candidateId,
            experimentId: configuration.experimentId,
            parentCandidateId,
            scenarioRevisionId: seed.scenario.revisionId,
            promptRevisionId: seed.promptRevisionId,
            mutationKind: configuration.mode === "red-team" ? "scenario" : "prompt",
            rationale: error.proposal.rationale,
            generatedBy: input.proposer.modelId,
            proposalJson: JSON.stringify(error.proposal),
            proposalTokens: response.outputTokens,
            proposalCostUsd: response.costUsd,
            validationIssues: error.issues,
          });
          await repository.completeProposalAttempt(
            configuration.experimentId,
            proposalAttemptId,
          );
          emit("deciding", iteration + 1, "Candidate rejected by mutation safety validation.", {
            candidateId,
            proposal: error.proposal,
            validationIssues: error.issues,
            decision: "rejected",
          });
          lastDecision = "rejected";
          lastProposal = error.proposal;
          lastValidationIssues = error.issues;
          continue;
        }
        proposal = mutated.proposal;
        lastProposal = proposal;
        lastValidationIssues = undefined;
        emit("validating", iteration + 1, "Validated proposal and derived canonical mutation metrics.", {
          candidateId,
          proposal,
        });
        const [scenarioRevision, promptRevision] = await Promise.all([
          configuration.mode === "red-team"
            ? repository.createScenarioRevision(mutated.scenario, seed.scenario.revisionId)
            : Promise.resolve({ revisionId: seed.scenario.revisionId }),
          configuration.mode === "blue-team"
            ? repository.createPromptRevision(
                mutated.prompt.systemPrompt,
                mutated.prompt.systemPromptMode,
                seed.promptRevisionId,
              )
            : Promise.resolve({ revisionId: seed.promptRevisionId }),
        ]);
        mutated.scenario = {
          ...mutated.scenario,
          revisionId: scenarioRevision.revisionId,
        };
        await repository.createCandidate({
          candidateId,
          experimentId: configuration.experimentId,
          parentCandidateId: detail.candidates.filter((candidate) => candidate.status === "accepted").at(-1)
            ?.candidateId,
          scenarioRevisionId: scenarioRevision.revisionId,
          promptRevisionId: promptRevision.revisionId,
          mutationKind: configuration.mode === "red-team" ? "scenario" : "prompt",
          rationale: proposal.rationale,
          generatedBy: input.proposer.modelId,
          proposalJson: JSON.stringify(proposal),
          proposalTokens: response.outputTokens,
          proposalCostUsd: response.costUsd,
        });
        await repository.completeProposalAttempt(configuration.experimentId, proposalAttemptId);
      }
      abortIfRequested(input.signal);
      detail = await repository.loadExperiment(configuration.experimentId);
      assertCompleteHistory(detail);
      const candidateArtifacts = await ensureRunSet({
        input,
        budget,
        seed: {
          scenario: mutated.scenario,
          prompt: mutated.prompt,
          promptRevisionId:
            configuration.mode === "blue-team"
              ? detail.candidates.find((candidate) => candidate.candidateId === candidateId)!
                  .promptRevisionId
              : seed.promptRevisionId,
        },
        candidateId,
        iteration: iteration + 1,
        label: "candidate",
        existingRuns: detail.runs,
        revisionParents: {
          scenario:
            configuration.mode === "red-team" ? proposal.parentScenarioRevisionId : undefined,
          prompt: configuration.mode === "blue-team" ? proposal.parentPromptRevisionId : undefined,
        },
        emit,
      });
      abortIfRequested(input.signal);
      const candidate = aggregate(
        candidateArtifacts,
        configuration.mode,
        subtlety(mutated.editDistance, proposalLimits.maxEditDistance),
      );
      emit("evaluating", iteration + 1, "Comparing paired aggregate scores.", {
        candidateId,
        proposal,
        baseline,
        candidate,
      });
      const decision = compareAggregates(candidate, baseline, candidateId) > 0 ? "accepted" : "rejected";
      lastDecision = decision;
      const persistedCandidate = detail.candidates.find((entry) => entry.candidateId === candidateId);
      if (persistedCandidate?.status === "proposed") {
        await repository.decideCandidate(candidateId, decision);
      } else if (persistedCandidate && persistedCandidate.status !== decision) {
        throw new Error(`Candidate ${candidateId} already has conflicting decision ${persistedCandidate.status}.`);
      }
      emit("deciding", iteration + 1, `Candidate ${decision}.`, {
        candidateId,
        proposal,
        baseline,
        candidate,
        decision,
      });
      if (decision === "accepted") {
        baseline = candidate;
        const acceptedRecord = (await repository.loadExperiment(configuration.experimentId)).candidates.find(
          (entry) => entry.candidateId === candidateId,
        );
        if (!acceptedRecord) throw new Error(`Accepted candidate ${candidateId} was not persisted.`);
        seed = {
          scenario: mutated.scenario,
          prompt: mutated.prompt,
          promptRevisionId: acceptedRecord.promptRevisionId,
        };
      }
    }
    await repository.completeExperiment(configuration.experimentId);
    return emit("completed", iterationLimit, "Optimization budget completed.", {
      baseline,
      decision: lastDecision,
      proposal: lastProposal,
      validationIssues: lastValidationIssues,
    });
  } catch (error) {
    if (error instanceof OptimizerLeaseConflictError) {
      return emit("waiting", detail.candidates.length, error.message);
    }
    if (isAbort(error) || input.signal?.aborted) {
      await repository.cancelExperiment(configuration.experimentId);
      return emit("cancelled", detail.candidates.length, "Optimization cancelled.");
    }
    const message = formatError(error);
    await repository.failExperiment(configuration.experimentId, message);
    emit("failed", detail.candidates.length, message, {
      validationIssues: error instanceof ProposalValidationError ? error.issues : undefined,
    });
    throw error;
  }
}

type RunSetInput = {
  input: OptimizerControllerInput;
  budget: OptimizerBudget;
  seed: OptimizerSeed;
  candidateId: string | undefined;
  iteration: number;
  label: "baseline" | "candidate";
  existingRuns: StoredRunSummary[];
  revisionParents:
    | {
        scenario?: string;
        prompt?: string;
      }
    | undefined;
  emit: (
    phase: OptimizerProgress["phase"],
    iteration: number,
    message: string,
    extras?: Partial<OptimizerProgress>,
  ) => OptimizerProgress;
};

async function ensureRunSet(runSet: RunSetInput) {
  const configurations = [
    {
      seed: runSet.seed,
      modelId: runSet.input.configuration.evaluatedModelId,
      suffix: "primary",
    },
    ...(runSet.input.configuration.holdout
      ? [
          {
            seed: runSet.seed,
            modelId: runSet.input.configuration.holdout.evaluatedModelId,
            suffix: "holdout",
          },
        ]
      : []),
  ];
  const artifacts: RunArtifact[] = [];
  const expectedRuns = configurations.flatMap((configuration) =>
    Array.from({ length: runSet.input.configuration.limits.repeats }, (_, repeat) => ({
      configuration,
      repeat,
      runId: stableRunId(
        runSet.input.configuration.experimentId,
        runSet.label,
        runSet.iteration,
        configuration.suffix,
        repeat,
      ),
    })),
  );
  for (const expected of expectedRuns) {
    const stored = runSet.existingRuns.find((run) => run.runId === expected.runId);
    if (stored?.status === "failed") throw new Error(`Persisted run ${expected.runId} has failed.`);
    if (stored?.status === "running") {
      throw new OptimizerLeaseConflictError(
        `Persisted run ${expected.runId} is still running; refusing to duplicate a potentially billable attempt.`,
      );
    }
  }
  runSet.budget.assertCanRun(
    expectedRuns.filter(
      ({ runId }) =>
        runSet.existingRuns.find((run) => run.runId === runId)?.status !== "completed",
    ).length,
  );
  for (const configuration of configurations) {
    for (let repeat = 0; repeat < runSet.input.configuration.limits.repeats; repeat += 1) {
      abortIfRequested(runSet.input.signal);
      const runId = stableRunId(
        runSet.input.configuration.experimentId,
        runSet.label,
        runSet.iteration,
        configuration.suffix,
        repeat,
      );
      const stored = runSet.existingRuns.find((run) => run.runId === runId);
      if (stored?.status === "completed") {
        artifacts.push((await runSet.input.repository.loadRunDetail(runId)).artifact);
        continue;
      }
      runSet.emit(
        runSet.label === "baseline" ? "baseline" : "running-candidate",
        runSet.iteration,
        `Running ${configuration.suffix} ${runSet.label} repeat ${repeat + 1}.`,
      );
      const beginState = await runSet.input.repository.beginRun({
        runId,
        source: "experiment",
        experimentId: runSet.input.configuration.experimentId,
        candidateId: runSet.candidateId,
        scenario: configuration.seed.scenario,
        scenarioParentRevisionId:
          configuration.suffix === "primary" ? runSet.revisionParents?.scenario : undefined,
        effectiveSystemPrompt: configuration.seed.prompt.systemPrompt,
        systemPromptMode: configuration.seed.prompt.systemPromptMode,
        promptParentRevisionId:
          configuration.suffix === "primary" ? runSet.revisionParents?.prompt : undefined,
        model: configuration.modelId,
        startedAt: Date.now(),
      });
      if (beginState === "completed") {
        const completedArtifact = (await runSet.input.repository.loadRunDetail(runId)).artifact;
        runSet.budget.consumeRun(totalTokens(completedArtifact), totalCost(completedArtifact));
        artifacts.push(completedArtifact);
        continue;
      }
      let artifact: RunArtifact;
      try {
        artifact = await runSet.input.evaluatedAgent.run({
          runId,
          scenario: configuration.seed.scenario,
          prompt: configuration.seed.prompt,
          modelId: configuration.modelId,
          maxTokens: runSet.input.configuration.limits.maxTokensPerEvaluatedRun,
          signal: runSet.input.signal,
        });
        runSet.budget.consumeRun(totalTokens(artifact), totalCost(artifact));
        await runSet.input.repository.finishRun({
          status: runFailed(artifact) ? "failed" : "completed",
          artifact,
        });
      } catch (error) {
        await runSet.input.repository.abortRun(
          runId,
          isAbort(error) ? "cancelled" : "execution_failed",
        );
        throw error;
      }
      if (runFailed(artifact)) throw new Error(`Evaluated run ${runId} failed.`);
      artifacts.push(artifact);
    }

  }
  return artifacts;
}

function expectedRunCount(configuration: OptimizerConfiguration) {
  return configuration.limits.repeats * (configuration.holdout ? 2 : 1);
}

function assertCompleteHistory(
  detail: Awaited<ReturnType<ExperimentRepository["loadExperiment"]>>,
) {
  if (detail.candidatesTruncated || detail.runsTruncated) {
    throw new Error("Experiment history is truncated; refusing incomplete budget reconstruction.");
  }
}

function assertExperimentSeed(
  detail: Awaited<ReturnType<ExperimentRepository["loadExperiment"]>>,
  input: OptimizerControllerInput,
) {
  if (
    detail.experiment.objective !== input.configuration.objective ||
    detail.experiment.scenarioRevisionId !== input.seed.scenario.revisionId ||
    detail.experiment.promptRevisionId !== input.seed.promptRevisionId
  ) {
    throw new Error("Optimizer seed or objective does not match the persisted experiment.");
  }
}

function createAttemptId() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Secure proposal attempt identifiers are unavailable.");
  }
  return `proposal-${crypto.randomUUID()}`;
}

async function reconstructBudget(
  repository: ExperimentRepository,
  runs: StoredRunSummary[],
  candidates: Array<{ proposalTokens?: number; proposalCostUsd?: number }>,
  configuration: OptimizerConfiguration,
) {
  const artifacts = await Promise.all(
    runs
      .filter((run) => run.runId && run.status === "completed")
      .map(async (run) => (await repository.loadRunDetail(run.runId!)).artifact),
  );
  const reservedRuns = runs.filter((run) => run.status !== "completed").length;
  return new OptimizerBudget(configuration.limits, {
    iterations: candidates.length,
    candidates: candidates.length,
    evaluatedRuns: artifacts.length + reservedRuns,
    proposalTokens: candidates.reduce(
      (sum, candidate) => sum + (candidate.proposalTokens ?? configuration.limits.maxTokensPerProposal),
      0,
    ),
    evaluatedAgentTokens:
      artifacts.reduce((sum, artifact) => sum + totalTokens(artifact), 0) +
      reservedRuns * configuration.limits.maxReservedTokensPerEvaluatedRun,
    estimatedSpendUsd:
      candidates.reduce(
        (sum, candidate) =>
          sum + (candidate.proposalCostUsd ?? configuration.limits.estimatedProposalCostUsd),
        0,
      ) +
      artifacts.reduce((sum, artifact) => sum + totalCost(artifact), 0) +
      reservedRuns * configuration.limits.estimatedEvaluatedRunCostUsd,
  });
}

function aggregate(
  artifacts: RunArtifact[],
  mode: OptimizerConfiguration["mode"],
  subtletyScore: number,
): AggregateScore {
  return aggregateScores(
    artifacts.map((artifact) => scoreArtifact(artifact, mode, subtletyScore)),
    mode,
  );
}

function stableCandidateId(experimentId: string, iteration: number) {
  return `candidate-${experimentId}-${iteration + 1}`;
}

function stableRunId(
  experimentId: string,
  label: string,
  iteration: number,
  set: string,
  repeat: number,
) {
  return `run-${experimentId}-${label}-${iteration}-${set}-${repeat + 1}`;
}

function totalTokens(artifact: RunArtifact) {
  return artifact.usage.reduce((sum, usage) => sum + usage.totalTokens, 0);
}

function totalCost(artifact: RunArtifact) {
  return artifact.usage.reduce((sum, usage) => sum + usage.cost.total, 0);
}

function subtlety(editDistance: number, maximum: number) {
  return Math.max(0, 1 - editDistance / Math.max(1, maximum));
}

function runFailed(artifact: RunArtifact) {
  return artifact.errors.some((error) => ["setup", "provider", "runner"].includes(error.phase));
}

function abortIfRequested(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException("Optimizer cancelled.", "AbortError");
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatError(error: unknown) {
  if (error instanceof ProposalValidationError) {
    return error.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n").slice(0, 4000);
  }

  return (error instanceof Error ? error.message : String(error)).slice(0, 4000);
}

function parseValidationIssues(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (issue) =>
        typeof issue === "object" &&
        issue !== null &&
        typeof issue.path === "string" &&
        typeof issue.code === "string" &&
        typeof issue.message === "string",
    )
  ) {
    throw new Error("Persisted candidate validation issues are invalid.");
  }
  return parsed as ProposalValidationError["issues"];
}
