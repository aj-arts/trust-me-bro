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

export const baseRunnerModelGroups: RunnerModelGroup[] = [
  {
    label: "Dashboard",
    models: dashboardModels,
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

const knownModels = new Map(
  baseRunnerModelGroups
    .flatMap((group) => group.models)
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
  const savedModels = Array.from(new Set(savedModelIds))
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
