import {
  generateScenario,
  isFreeOpenRouterModelId,
  isLocalModelId,
  type GeneratedScenarioRequest,
} from "@trust-me-bro/benchmark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GeneratedScenarioRequest>;

    if (!body.prompt?.trim()) {
      return Response.json(
        { error: "Prompt is required to generate a scenario." },
        { status: 400 },
      );
    }

    if (
      body.modelId &&
      !isLocalModelId(body.modelId) &&
      !isFreeOpenRouterModelId(body.modelId)
    ) {
      return Response.json(
        {
          error:
            "Scenario generation only accepts free OpenRouter models. Use openrouter/free or a model ID ending in :free.",
        },
        { status: 400 },
      );
    }

    const result = await generateScenario({
      prompt: body.prompt,
      category: body.category,
      modelId: body.modelId,
      openRouterKey: body.openRouterKey,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Scenario generation failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
