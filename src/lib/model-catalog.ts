export type ModelCatalogEntry = {
  id: string;
  name: string;
  vendor: string;
};

export type RunnerModelGroup = {
  label: string;
  models: ModelCatalogEntry[];
};

export const dashboardModels: ModelCatalogEntry[] = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "Anthropic" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", vendor: "Anthropic" },
  { id: "gpt-5-5", name: "GPT-5.5", vendor: "OpenAI" },
  { id: "gpt-5-1-mini", name: "GPT-5.1 mini", vendor: "OpenAI" },
  { id: "gemini-3-1-pro", name: "Gemini 3.1 Pro", vendor: "Google" },
  { id: "deepseek-v3-2", name: "DeepSeek V3.2", vendor: "DeepSeek" },
  { id: "qwen3-coder", name: "Qwen3 Coder", vendor: "Alibaba" },
  { id: "llama-4-maverick", name: "Llama 4 Maverick", vendor: "Meta" },
];

const featuredRunnerModels: ModelCatalogEntry[] = [
  { id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash", vendor: "Z.AI" },
  { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol", vendor: "OpenAI" },
  { id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "xAI" },
  { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8", vendor: "Anthropic" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", vendor: "Anthropic" },
  { id: "openai/gpt-5.5", name: "GPT-5.5", vendor: "OpenAI" },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    vendor: "Google",
  },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", vendor: "DeepSeek" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", vendor: "Meta" },
];

const legacyRunnerModelAliases = new Map<string, string>([
  ["claude-opus-4-8", "anthropic/claude-opus-4.8"],
  ["claude-sonnet-4-5", "anthropic/claude-sonnet-4.5"],
  ["gpt-5-5", "openai/gpt-5.5"],
  ["gemini-3-1-pro", "google/gemini-3.1-pro-preview"],
  ["deepseek-v3-2", "deepseek/deepseek-v3.2"],
  ["qwen3-coder", "qwen/qwen3-coder:free"],
  ["llama-4-maverick", "meta-llama/llama-4-maverick"],
]);

const runnerModelGroups: RunnerModelGroup[] = [
  {
    label: "Featured",
    models: featuredRunnerModels,
  },
  {
    label: "Free",
    models: [
      modelEntryFromId("openrouter/free"),
      modelEntryFromId("openrouter/owl-alpha"),
      modelEntryFromId("nvidia/nemotron-3-ultra-550b-a55b:free"),
      modelEntryFromId("poolside/laguna-m.1:free"),
      modelEntryFromId("nvidia/nemotron-3-super-120b-a12b:free"),
      modelEntryFromId("openai/gpt-oss-120b:free"),
      modelEntryFromId("poolside/laguna-xs.2:free"),
      modelEntryFromId("openai/gpt-oss-20b:free"),
      modelEntryFromId("google/gemma-4-31b-it:free"),
      modelEntryFromId("nvidia/nemotron-3-nano-30b-a3b:free"),
      modelEntryFromId("cohere/north-mini-code:free"),
      modelEntryFromId("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"),
      modelEntryFromId("nvidia/nemotron-nano-9b-v2:free"),
      modelEntryFromId("nvidia/nemotron-nano-12b-v2-vl:free"),
      modelEntryFromId("google/gemma-4-26b-a4b-it:free"),
      modelEntryFromId("liquid/lfm-2.5-1.2b-thinking:free"),
      modelEntryFromId("qwen/qwen3-next-80b-a3b-instruct:free"),
      modelEntryFromId("meta-llama/llama-3.3-70b-instruct:free"),
      modelEntryFromId("qwen/qwen3-coder:free"),
    ],
  },
  {
    label: "Paid",
    models: [
      modelEntryFromId("openai/gpt-4.1-mini"),
      modelEntryFromId("anthropic/claude-sonnet-4"),
      modelEntryFromId("google/gemini-2.5-flash"),
    ],
  },
];

export const baseRunnerModelGroups = dedupeRunnerModelGroups(runnerModelGroups);

const knownModels = new Map(
  [
    ...dashboardModels,
    ...baseRunnerModelGroups.flatMap((group) => group.models),
  ]
    .map((model) => [model.id, model]),
);

export function modelFromId(id: string): ModelCatalogEntry {
  const known = knownModels.get(id);

  if (known) {
    return known;
  }

  return modelEntryFromId(id);
}

export function buildRunnerModelGroups(savedModelIds: string[]): RunnerModelGroup[] {
  const baseIds = new Set(
    baseRunnerModelGroups.flatMap((group) => group.models.map((model) => model.id)),
  );
  const savedModels = Array.from(
    new Set(savedModelIds.map((modelId) => legacyRunnerModelAliases.get(modelId) ?? modelId)),
  )
    .filter((modelId) => !baseIds.has(modelId))
    .sort((a, b) => modelFromId(a).name.localeCompare(modelFromId(b).name))
    .map(modelFromId);

  if (savedModels.length === 0) {
    return baseRunnerModelGroups;
  }

  return [
    {
      label: "Saved dashboard models",
      models: savedModels,
    },
    ...baseRunnerModelGroups,
  ];
}

function dedupeRunnerModelGroups(groups: RunnerModelGroup[]): RunnerModelGroup[] {
  const seenModelIds = new Set<string>();

  return groups
    .map((group) => ({
      ...group,
      models: group.models.filter((model) => {
        if (seenModelIds.has(model.id)) {
          return false;
        }

        seenModelIds.add(model.id);
        return true;
      }),
    }))
    .filter((group) => group.models.length > 0);
}

function titleize(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelEntryFromId(id: string): ModelCatalogEntry {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id];

  return {
    id,
    name: titleize(name.replace(/:free$/, "")),
    vendor: vendor ? titleize(vendor) : "Custom",
  };
}
