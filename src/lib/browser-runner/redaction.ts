import type { JsonValue } from "./types.ts";

const SENSITIVE_KEY =
  /^(authorization|proxy[-_]?authorization|x[-_]?api[-_]?key|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|cookie|set[-_]?cookie|password|secret|token)$/i;
const BEARER_VALUE = /^bearer\s+\S+/i;
const OPENROUTER_KEY = /\bsk-or-v1-[A-Za-z0-9_-]+\b/g;

export function toRedactedJson(value: unknown): JsonValue {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): JsonValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") {
    if (BEARER_VALUE.test(value)) return "[REDACTED]";
    return value.replace(OPENROUTER_KEY, "[REDACTED]");
  }
  if (typeof value === "undefined") return null;
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }

  const output: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(entry, seen);
  }
  return output;
}
