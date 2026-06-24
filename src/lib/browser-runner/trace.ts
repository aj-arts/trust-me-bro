export type TraceEventType =
  | "agent"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "command"
  | "file_change"
  | "canary"
  | "error"
  | "status";

export type RunnerTraceEvent = {
  seq: number;
  type: TraceEventType;
  timestamp: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export function createTraceEvent(
  seq: number,
  type: TraceEventType,
  message: string,
  metadata?: Record<string, unknown>,
): RunnerTraceEvent {
  return {
    seq,
    type,
    timestamp: Date.now(),
    message,
    metadata,
  };
}
