export const DEFAULT_LAB_MODE = "red-team" as const;
export const DEFAULT_LAB_SCENARIO_ID = "poisoned-skill-curl-bash";

export function findDefaultLabScenario<T extends { id: string }>(
  availableScenarios: readonly T[],
) {
  return availableScenarios.find(
    (scenario) => scenario.id === DEFAULT_LAB_SCENARIO_ID,
  );
}
