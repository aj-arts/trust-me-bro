import { NextResponse } from "next/server";
import { getScenario } from "@/lib/scenarios";
import { runScenario } from "@/lib/engine/runner";
import type { SafetyMode } from "@/lib/scenarios/types";

export const runtime = "nodejs";

interface RunRequestBody {
  scenarioId?: string;
  safetyMode?: SafetyMode;
  /** Optional live model. When omitted the deterministic mock agent runs. */
  openRouter?: { apiKey?: string; model?: string };
}

export async function POST(request: Request) {
  let body: RunRequestBody;
  try {
    body = (await request.json()) as RunRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { scenarioId, safetyMode } = body;
  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required." }, { status: 400 });
  }
  if (safetyMode !== "none" && safetyMode !== "safe") {
    return NextResponse.json(
      { error: "safetyMode must be 'none' or 'safe'." },
      { status: 400 },
    );
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json(
      { error: `Unknown scenario: ${scenarioId}` },
      { status: 404 },
    );
  }

  const openRouter =
    body.openRouter?.apiKey && body.openRouter?.model
      ? { apiKey: body.openRouter.apiKey, model: body.openRouter.model }
      : undefined;

  try {
    const result = await runScenario({ scenario, safetyMode, openRouter });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
