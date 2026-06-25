import { siClaude, siDeepseek, siGooglegemini } from "simple-icons";

export type ModelMeta = {
  provider: string;
  barColor: string;
  logoColor: string;
  iconPath?: string;
};

// `barColor` is the (deliberately non-brand) chart color; `logoColor` is the real
// brand color used to render the actual provider logo. OpenAI has no open-set logo,
// so it falls back to a drawn blossom mark in ProviderLogo.
const META: Record<string, ModelMeta> = {
  "gpt-4.1-mini": { provider: "OpenAI", barColor: "#4f46e5", logoColor: "#1c1a17" },
  "claude-sonnet-4": {
    provider: "Anthropic",
    barColor: "#0ea5e9",
    logoColor: "#d97757",
    iconPath: siClaude.path,
  },
  "gemini-2.5-flash": {
    provider: "Google",
    barColor: "#10b981",
    logoColor: "#4285f4",
    iconPath: siGooglegemini.path,
  },
  "deepseek-chat": {
    provider: "DeepSeek",
    barColor: "#f43f5e",
    logoColor: "#4d6bfe",
    iconPath: siDeepseek.path,
  },
};

const FALLBACK_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f43f5e", "#f59e0b"];

export function modelMeta(model: string, index = 0): ModelMeta {
  return (
    META[model] ?? {
      provider: "Unknown",
      barColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      logoColor: "#1c1a17",
    }
  );
}
