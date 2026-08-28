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

export type TraceRecorder = {
  events: RunnerTraceEvent[];
  emit: (
    type: TraceEventType,
    message: string,
    metadata?: Record<string, unknown>,
  ) => RunnerTraceEvent;
  stream: (
    streamId: string,
    type: Extract<TraceEventType, "agent" | "reasoning">,
    message: string,
  ) => RunnerTraceEvent | undefined;
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

export function createTraceRecorder(
  onTrace: (event: RunnerTraceEvent) => void = () => undefined,
  now: () => number = Date.now,
): TraceRecorder {
  const events: RunnerTraceEvent[] = [];
  const streamSequences = new Map<string, number>();

  return {
    events,
    emit(type, message, metadata) {
      const event = {
        seq: events.length,
        type,
        timestamp: now(),
        message,
        metadata,
      };
      events.push(event);
      onTrace(event);
      return event;
    },
    stream(streamId, type, message) {
      if (!message.trim()) return undefined;

      const existingSequence = streamSequences.get(streamId);
      const event = {
        seq: existingSequence ?? events.length,
        type,
        timestamp: now(),
        message: message.trimStart(),
        metadata: { streamId },
      };

      if (existingSequence === undefined) {
        streamSequences.set(streamId, event.seq);
        events.push(event);
      } else {
        events[existingSequence] = event;
      }
      onTrace(event);
      return event;
    },
  };
}
