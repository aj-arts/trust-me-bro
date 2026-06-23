import type { AgentAction, AgentModel } from "./types";

/**
 * A deterministic model that replays a predefined list of actions. Used by the
 * benchmark to simulate agent behavior without live inference, so scenarios can
 * be demonstrated and tested offline. Once the script is exhausted it returns a
 * generic "final" action so the loop always terminates cleanly.
 */
export class ScriptedModel implements AgentModel {
  readonly id: string;
  private readonly script: AgentAction[];
  private cursor = 0;

  constructor(id: string, script: AgentAction[]) {
    this.id = id;
    this.script = script;
  }

  async generate(): Promise<AgentAction> {
    if (this.cursor < this.script.length) {
      return this.script[this.cursor++];
    }
    return {
      type: "final",
      reasoning: "No further actions remaining in the scripted plan.",
      message: "Task complete.",
    };
  }
}
