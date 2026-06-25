import {
  promptModes,
  type BenchModel,
  type HeatRow,
  type ModelScore,
  type PromptModeId,
  type RobustnessSeries,
  type ScenarioDifficultyRow,
} from "@/lib/dashboard/mock-data";

export type SavedRunForDashboard = {
  scenarioId: string;
  scenarioTitle: string;
  model: string;
  systemPromptMode: PromptModeId;
  passed: boolean;
};

type CellKey = `${string}\n${string}\n${PromptModeId}`;

export function buildRealDashboardData(savedRuns: SavedRunForDashboard[]) {
  const runs = savedRuns.filter((run) =>
    promptModes.some((mode) => mode.id === run.systemPromptMode),
  );
  const models = Array.from(new Set(runs.map((run) => run.model)))
    .sort()
    .map(modelFromId);
  const scenarios = Array.from(
    new Map(
      runs.map((run) => [
        run.scenarioId,
        {
          id: run.scenarioId,
          title: run.scenarioTitle,
          short: shortScenarioTitle(run.scenarioTitle),
          blurb: run.scenarioTitle,
        },
      ]),
    ).values(),
  ).sort((a, b) => a.title.localeCompare(b.title));
  const cellCounts = buildCellCounts(runs);

  function totalRuns(mode: PromptModeId) {
    return runs.filter((run) => run.systemPromptMode === mode).length;
  }

  function totalRunsAllModes() {
    return runs.length;
  }

  function rankedSafetyScores(mode: PromptModeId): ModelScore[] {
    return models
      .map((model) => {
        const scoredCells = scenarios
          .map((scenario) => cellScore(cellCounts, model.id, scenario.id, mode))
          .filter((cell) => cell.runs > 0);
        const runCount = scoredCells.reduce((sum, cell) => sum + cell.runs, 0);

        if (runCount === 0) return null;

        return {
          model,
          score:
            scoredCells.reduce((sum, cell) => sum + cell.passRate, 0) /
            scoredCells.length,
          runs: runCount,
        };
      })
      .filter((score): score is ModelScore => score !== null)
      .sort((a, b) => b.score - a.score);
  }

  function robustnessSeries(): RobustnessSeries[] {
    return models
      .map((model) => ({
        model,
        points: promptModes.map((mode) => ({
          mode: mode.id,
          score: modelScoreForMode(model.id, mode.id),
        })),
      }))
      .filter((series) => series.points.some((point) => point.score !== null))
      .sort((a, b) => (lastScore(b) ?? -1) - (lastScore(a) ?? -1));
  }

  function heatmap(mode: PromptModeId): HeatRow[] {
    return models
      .map((model) => {
        const cells = scenarios.map((scenario) => {
          const score = cellScore(cellCounts, model.id, scenario.id, mode);
          return {
            scenario,
            rate: score.runs === 0 ? 0 : 1 - score.passRate,
            runs: score.runs,
          };
        });
        const scored = cells.filter((cell) => cell.runs > 0);
        const mean =
          scored.reduce((sum, cell) => sum + cell.rate, 0) / (scored.length || 1);
        return { model, cells, mean };
      })
      .filter((row) => row.cells.some((cell) => cell.runs > 0))
      .sort((a, b) => a.mean - b.mean);
  }

  function scenarioDifficultyRanking(mode: PromptModeId): ScenarioDifficultyRow[] {
    return scenarios
      .map((scenario) => {
        const scoredCells = models
          .map((model) => cellScore(cellCounts, model.id, scenario.id, mode))
          .filter((cell) => cell.runs > 0);
        const runCount = scoredCells.reduce((sum, cell) => sum + cell.runs, 0);

        if (runCount === 0) return null;

        return {
          scenario,
          rate:
            scoredCells.reduce((sum, cell) => sum + (1 - cell.passRate), 0) /
            scoredCells.length,
          runs: runCount,
        };
      })
      .filter((row): row is ScenarioDifficultyRow => row !== null)
      .sort((a, b) => b.rate - a.rate);
  }

  function modelScoreForMode(modelId: string, mode: PromptModeId) {
    const scoredCells = scenarios
      .map((scenario) => cellScore(cellCounts, modelId, scenario.id, mode))
      .filter((cell) => cell.runs > 0);

    if (scoredCells.length === 0) return null;

    return (
      scoredCells.reduce((sum, cell) => sum + cell.passRate, 0) /
      scoredCells.length
    );
  }

  return {
    models,
    scenarios,
    promptModes,
    totalRuns,
    totalRunsAllModes,
    rankedSafetyScores,
    robustnessSeries,
    heatmap,
    scenarioDifficultyRanking,
  };
}

function buildCellCounts(runs: SavedRunForDashboard[]) {
  const counts = new Map<CellKey, { passed: number; runs: number }>();

  for (const run of runs) {
    const key = cellKey(run.model, run.scenarioId, run.systemPromptMode);
    const current = counts.get(key) ?? { passed: 0, runs: 0 };
    counts.set(key, {
      passed: current.passed + (run.passed ? 1 : 0),
      runs: current.runs + 1,
    });
  }

  return counts;
}

function cellScore(
  counts: Map<CellKey, { passed: number; runs: number }>,
  modelId: string,
  scenarioId: string,
  mode: PromptModeId,
) {
  const count = counts.get(cellKey(modelId, scenarioId, mode));
  const runs = count?.runs ?? 0;
  return {
    runs,
    passRate: runs === 0 ? 0 : (count?.passed ?? 0) / runs,
  };
}

function cellKey(modelId: string, scenarioId: string, mode: PromptModeId): CellKey {
  return `${modelId}\n${scenarioId}\n${mode}`;
}

function modelFromId(id: string): BenchModel {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id];

  return {
    id,
    name: titleize(name.replace(/:free$/, "")),
    vendor: vendor ? titleize(vendor) : "Custom",
  };
}

function shortScenarioTitle(title: string) {
  return title
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

function titleize(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lastScore(series: RobustnessSeries) {
  return [...series.points].reverse().find((point) => point.score !== null)?.score ?? null;
}
