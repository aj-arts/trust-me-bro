import { createTraceEvent, type RunnerTraceEvent } from "@/lib/browser-runner/trace";
import { getScenarioDefinition } from "@/scenarios/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    scenarioId?: unknown;
    openRouterKey?: unknown;
    model?: unknown;
  };

  if (
    typeof body.scenarioId !== "string" ||
    typeof body.openRouterKey !== "string" ||
    typeof body.model !== "string"
  ) {
    return new Response("Invalid scenario run request.", { status: 400 });
  }

  const { scenarioId, openRouterKey, model } = body as {
    scenarioId: string;
    openRouterKey: string;
    model: string;
  };

  const scenario = getScenarioDefinition(scenarioId);
  if (!scenario) {
    return new Response(`Scenario not found: ${scenarioId}`, { status: 404 });
  }

  const encoder = new TextEncoder();
  let nextSeq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RunnerTraceEvent) => {
        nextSeq = Math.max(nextSeq, event.seq + 1);
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await scenario.run({
          openRouterKey,
          model,
          onTrace: send,
        });
      } catch (error) {
        send(
          createTraceEvent(
            nextSeq,
            "error",
            error instanceof Error ? error.message : "Scenario failed.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-ndjson",
    },
  });
}
