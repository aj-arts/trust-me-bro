export type OpenRouterSessionConfig = {
  apiKey: string;
  model: string;
};

export type OpenRouterSession = {
  apiKey: string;
  model: string;
};

export function createOpenRouterSession(config: OpenRouterSessionConfig): OpenRouterSession {
  if (!config.apiKey.trim()) {
    throw new Error("OpenRouter key is required.");
  }

  return {
    apiKey: config.apiKey,
    model: config.model,
  };
}
