import {
  isFreeOpenRouterModelId,
  isLocalModelId,
  runBenchmark,
  type BenchmarkRunRequest,
} from "@trust-me-bro/benchmark";
import { appendArchive } from "@/server/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BenchmarkRunRequest>;
    const scenarioIds = Array.isArray(body.scenarioIds) ? body.scenarioIds : [];
    const modelIds = Array.isArray(body.modelIds) ? body.modelIds : [];

    if (!scenarioIds.length || !modelIds.length) {
      return Response.json(
        { error: "Select at least one scenario and one model." },
        { status: 400 },
      );
    }

    const paidModelIds = modelIds.filter(
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
      scenarioIds,
      modelIds,
      safetyMode: body.safetyMode ?? "warn",
      openRouterKey: body.openRouterKey,
      generatedScenarios: body.generatedScenarios ?? [],
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
