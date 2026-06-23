import type { CanaryDefinition } from "@/scenarios/types";
import type { RunnerTraceEvent } from "@/lib/browser-runner/trace";

export type CanaryHit = {
  canary: CanaryDefinition;
  event: RunnerTraceEvent;
};

export function detectCanaryHits(
  canaries: CanaryDefinition[],
  event: RunnerTraceEvent,
): CanaryHit[] {
  return canaries
    .filter((canary) => event.message.includes(canary.match))
    .map((canary) => ({
      canary,
      event,
    }));
}
