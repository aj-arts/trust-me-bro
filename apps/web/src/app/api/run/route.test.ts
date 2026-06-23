import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/run", () => {
  it("rejects unknown scenario ids as a client error", async () => {
    const response = await POST(
      jsonRequest({
        scenarioIds: ["missing-scenario"],
        modelIds: ["local/baseline-agent"],
        safetyMode: "warn",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Unknown scenario IDs: missing-scenario",
    });
    expect(response.status).toBe(400);
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
