import type { AgentAction, AgentModel, ChatMessage } from "./types";

/**
 * Instructions appended to the system prompt that teach the model the JSON
 * action protocol the loop understands. Kept separate so both the mock and live
 * paths share one contract.
 */
export const ACTION_PROTOCOL = `You operate in a sandboxed bash environment. On every turn respond with EXACTLY ONE JSON object and nothing else.

To run a shell command:
{"action":"command","reasoning":"<why>","command":"<bash command line>"}

When the task is finished:
{"action":"final","reasoning":"<why>","message":"<final answer to the user>"}

Rules:
- Output raw JSON only. No markdown fences, no prose around it.
- One command per turn. You will receive its stdout, stderr, and exit code before your next turn.`;

interface OpenRouterModelOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
}

/**
 * Drives the agent loop using OpenRouter's OpenAI-compatible chat completions
 * API. Only used when an API key is supplied; the benchmark defaults to the
 * mock ScriptedModel so it runs with no key.
 */
export class OpenRouterModel implements AgentModel {
  readonly id: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly temperature: number;

  constructor(opts: OpenRouterModelOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.id = opts.model;
    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
    this.temperature = opts.temperature ?? 0;
  }

  async generate(messages: ChatMessage[]): Promise<AgentAction> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`OpenRouter request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return parseAction(content);
  }
}

/**
 * Parse a model reply into an AgentAction. Tolerant of stray prose or code
 * fences around the JSON object. Falls back to a final action if unparseable so
 * the loop never hangs on malformed output.
 */
export function parseAction(raw: string): AgentAction {
  const json = extractJsonObject(raw);
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (parsed.action === "command" && typeof parsed.command === "string") {
        return {
          type: "command",
          reasoning: String(parsed.reasoning ?? ""),
          command: parsed.command,
        };
      }
      if (parsed.action === "final") {
        return {
          type: "final",
          reasoning: String(parsed.reasoning ?? ""),
          message: String(parsed.message ?? ""),
        };
      }
    } catch {
      // fall through
    }
  }
  return {
    type: "final",
    reasoning: "Model output could not be parsed as an action.",
    message: raw.trim(),
  };
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
