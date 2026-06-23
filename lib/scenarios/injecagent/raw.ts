import userCasesJson from "@/data/injecagent/user_cases.json";
import attackerDhJson from "@/data/injecagent/attacker_cases_dh.json";
import attackerDsJson from "@/data/injecagent/attacker_cases_ds.json";

/** A benign user task plus the tool response that carries the injection. */
export interface UserCase {
  "User Tool": string;
  "User Instruction": string;
  "Tool Parameters": string;
  /** Tool output with a `<Attacker Instruction>` placeholder to fill. */
  "Tool Response Template": string;
  Thought: string;
  Level: string;
}

/** An attacker case: the injected instruction and the tool(s) it abuses. */
export interface AttackerCase {
  "Attacker Tools": string[];
  Modifed: number;
  "Attacker Instruction": string;
  "Expected Achievements": string;
  "Attack Type": string;
}

export const userCases = userCasesJson as UserCase[];
export const attackerCasesDh = attackerDhJson as AttackerCase[];
export const attackerCasesDs = attackerDsJson as AttackerCase[];
