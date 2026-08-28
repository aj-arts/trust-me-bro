import type { Model } from "@earendil-works/pi-ai";

export type OpenRouterSessionConfig = {
  apiKey: string;
  model: string;
};

export type OpenRouterSession = {
  model: Model<"openai-completions">;
  modelId: string;
  getApiKey: (provider: string) => string | undefined;
};

export function createOpenRouterSession(config: OpenRouterSessionConfig): OpenRouterSession {
  if (!config.apiKey.trim()) {
    throw new Error("OpenRouter key is required.");
  }

  return {
    model: createOpenRouterModel(config.model),
    modelId: config.model,
    getApiKey: (provider) => (provider === "openrouter" ? config.apiKey : undefined),
  };
}

export function createOpenRouterModel(id: string): Model<"openai-completions"> {
  if (!id.trim()) {
    throw new Error("OpenRouter model is required.");
  }

  return {
    id,
    name: id,
    api: "openai-completions",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: true,
    compat: { thinkingFormat: "openrouter" },
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
  };
}
