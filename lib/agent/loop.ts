import type { Bash } from "just-bash";
import type { AgentModel, ChatMessage } from "./types";
import type { ExecutedCommand } from "../engine/types";

export interface AgentLoopResult {
  commands: ExecutedCommand[];
  finalMessage: string;
  steps: number;
  stoppedReason: "final" | "max-steps";
  messages: ChatMessage[];
}

export interface AgentLoopOptions {
  systemPrompt: string;
  userPrompt: string;
  maxSteps?: number;
  /**
   * Mutable reference updated to the current step index at the start of each
   * iteration. Lets out-of-band hooks (e.g. the network exfil canary) attribute
   * side effects to the step that caused them.
   */
  stepRef?: { current: number };
}

/** Truncate long command output before feeding it back to the model. */
function clip(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

/**
 * Runs the core agent loop: the model proposes one bash command at a time, the
 * command executes in the shared virtual `bash` environment, and the captured
 * stdout/stderr/exit code is fed back as a tool message. The loop ends when the
 * model emits a "final" action or `maxSteps` is reached.
 *
 * The filesystem persists across commands (that's the point — the agent builds
 * up state), but note just-bash resets per-exec shell state (env/cwd) between
 * calls, matching real isolated tool invocations.
 */
export async function runAgentLoop(
  bash: Bash,
  model: AgentModel,
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const maxSteps = options.maxSteps ?? 12;
  const messages: ChatMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userPrompt },
  ];
  const commands: ExecutedCommand[] = [];

  for (let step = 0; step < maxSteps; step++) {
    if (options.stepRef) options.stepRef.current = step;
    const action = await model.generate(messages, step);

    if (action.type === "final") {
      messages.push({
        role: "assistant",
        content: JSON.stringify({
          action: "final",
          reasoning: action.reasoning,
          message: action.message,
        }),
      });
      return {
        commands,
        finalMessage: action.message,
        steps: step,
        stoppedReason: "final",
        messages,
      };
    }

    messages.push({
      role: "assistant",
      content: JSON.stringify({
        action: "command",
        reasoning: action.reasoning,
        command: action.command,
      }),
    });

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    try {
      const result = await bash.exec(action.command);
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
    } catch (err) {
      stderr = err instanceof Error ? err.message : String(err);
      exitCode = 1;
    }

    commands.push({
      step,
      reasoning: action.reasoning,
      command: action.command,
      stdout,
      stderr,
      exitCode,
    });

    messages.push({
      role: "tool",
      content: clip(
        `$ ${action.command}\n--- stdout ---\n${stdout}--- stderr ---\n${stderr}--- exit code: ${exitCode} ---`,
      ),
    });
  }

  return {
    commands,
    finalMessage: "Reached the maximum number of steps without finishing.",
    steps: maxSteps,
    stoppedReason: "max-steps",
    messages,
  };
}
