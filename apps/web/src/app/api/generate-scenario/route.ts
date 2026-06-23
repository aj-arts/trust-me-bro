import {
  generateScenario,
  isFreeOpenRouterModelId,
  isLocalModelId,
} from "@trust-me-bro/benchmark";
import {
  jsonError,
  readJsonObject,
  readOptionalString,
  readScenarioCategory,
} from "@/server/api-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await readJsonObject(request);
    if ("response" in parsed) return parsed.response;

    const { body } = parsed;
    const prompt = readOptionalString(body, "prompt");

    if (prompt === null) {
      return jsonError("prompt must be a string.");
    }

    if (!prompt) {
      return Response.json(
        { error: "Prompt is required to generate a scenario." },
        { status: 400 },
      );
    }

    const category = readScenarioCategory(body);
    if ("response" in category) return category.response;

    const modelId = readOptionalString(body, "modelId");
    if (modelId === null) {
      return jsonError("modelId must be a string.");
    }

    const openRouterKey = readOptionalString(body, "openRouterKey");
    if (openRouterKey === null) {
      return jsonError("openRouterKey must be a string.");
    }

    if (
      modelId &&
      !isLocalModelId(modelId) &&
      !isFreeOpenRouterModelId(modelId)
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
      prompt,
      category: category.value,
      modelId,
      openRouterKey,
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
