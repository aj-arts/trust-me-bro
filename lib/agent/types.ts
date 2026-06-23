export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** The agent wants to run a shell command in the virtual environment. */
export interface AgentCommandAction {
  type: "command";
  /** The agent's reasoning for this step (trace). */
  reasoning: string;
  /** The bash command line to execute. */
  command: string;
}

/** The agent is done and returns a final message to the user. */
export interface AgentFinalAction {
  type: "final";
  reasoning: string;
  message: string;
}

export type AgentAction = AgentCommandAction | AgentFinalAction;

/**
 * A model that drives the agent loop. Implementations: ScriptedModel (mock,
 * deterministic) and OpenRouterModel (live inference). The loop is agnostic to
 * which one it uses.
 */
export interface AgentModel {
  readonly id: string;
  /**
   * Produce the next action given the running conversation.
   * @param messages full chat history (system + user + tool results)
   * @param stepIndex zero-based index of this step
   */
  generate(messages: ChatMessage[], stepIndex: number): Promise<AgentAction>;
}
