import { NextResponse } from "next/server";
import { listScenarioSummaries } from "@/lib/scenarios";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ scenarios: listScenarioSummaries() });
}
