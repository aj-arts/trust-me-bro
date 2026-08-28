export const DEFAULT_OPENROUTER_MODEL_ID = "z-ai/glm-5.3-flash";
export const OPENROUTER_GATEWAY_MAX_COMPLETION_TOKENS = 131_072;

export type OpenRouterModelCapabilities = {
  contextLength: number;
  maxCompletionTokens: number;
  source: "known" | "fallback";
};

const KNOWN_CAPABILITIES: Record<string, Omit<OpenRouterModelCapabilities, "source">> = {
  [DEFAULT_OPENROUTER_MODEL_ID]: {
    contextLength: 1_048_576,
    maxCompletionTokens: 131_072,
  },
};

const FALLBACK_CAPABILITIES: OpenRouterModelCapabilities = {
  contextLength: 128_000,
  maxCompletionTokens: 32_768,
  source: "fallback",
};

export function openRouterModelCapabilities(modelId: string): OpenRouterModelCapabilities {
  const known = KNOWN_CAPABILITIES[modelId];
  return known ? { ...known, source: "known" } : { ...FALLBACK_CAPABILITIES };
}

export function assertOpenRouterOutputTokenLimit(
  modelId: string,
  value: number,
  label: string,
) {
  const capabilities = openRouterModelCapabilities(modelId);
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > capabilities.maxCompletionTokens ||
    value > OPENROUTER_GATEWAY_MAX_COMPLETION_TOKENS
  ) {
    throw new Error(
      `${label} must be an integer from 1 to ${capabilities.maxCompletionTokens} for ${modelId} (${capabilities.source} capability).`,
    );
  }
}

export function assertOpenRouterReservationLimit(
  modelId: string,
  value: number,
  label: string,
) {
  const capabilities = openRouterModelCapabilities(modelId);
  if (!Number.isInteger(value) || value < 1 || value > capabilities.contextLength) {
    throw new Error(
      `${label} must be an integer from 1 to ${capabilities.contextLength} for ${modelId} (${capabilities.source} capability).`,
    );
  }
}
