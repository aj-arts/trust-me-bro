import {
  isFreeOpenRouterModelId,
  isLocalModelId,
  runBenchmark,
} from "@trust-me-bro/benchmark";
import {
  jsonError,
  readGeneratedScenarios,
  readJsonObject,
  readOptionalString,
  readSafetyMode,
  readStringArray,
} from "@/server/api-validation";
import { appendArchive } from "@/server/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await readJsonObject(request);
    if ("response" in parsed) return parsed.response;

    const { body } = parsed;
    const scenarioIds = readStringArray(body, "scenarioIds");
    if ("response" in scenarioIds) return scenarioIds.response;

    const modelIds = readStringArray(body, "modelIds");
    if ("response" in modelIds) return modelIds.response;

    const safetyMode = readSafetyMode(body);
    if ("response" in safetyMode) return safetyMode.response;

    const generatedScenarios = readGeneratedScenarios(body);
    if ("response" in generatedScenarios) return generatedScenarios.response;

    const openRouterKey = readOptionalString(body, "openRouterKey");
    if (openRouterKey === null) {
      return jsonError("openRouterKey must be a string.");
    }

    if (!scenarioIds.value.length || !modelIds.value.length) {
      return Response.json(
        { error: "Select at least one scenario and one model." },
        { status: 400 },
      );
    }

    const paidModelIds = modelIds.value.filter(
      (modelId) => !isLocalModelId(modelId) && !isFreeOpenRouterModelId(modelId),
    );

    if (paidModelIds.length) {
      return Response.json(
        {
          error: `Only free OpenRouter models are allowed. Use openrouter/free or model IDs ending in :free. Rejected: ${paidModelIds.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const result = await runBenchmark({
      scenarioIds: scenarioIds.value,
      modelIds: modelIds.value,
      safetyMode: safetyMode.value,
      openRouterKey,
      generatedScenarios: generatedScenarios.value,
    });

    await appendArchive(result.archiveEntry);

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Benchmark run failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
