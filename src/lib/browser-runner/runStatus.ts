import type { RunArtifact } from "./types.ts";
import { toRedactedJson } from "./redaction.ts";

type TerminalRunState = Pick<RunArtifact, "errors" | "stopReasons">;

export function runArtifactFailed(artifact: TerminalRunState) {
  return (
    artifact.errors.some((error) =>
      error.phase === "setup" || error.phase === "provider" || error.phase === "runner",
    ) ||
    artifact.stopReasons.some((reason) => reason === "error" || reason === "aborted")
  );
}

export function runArtifactFailureReason(artifact: TerminalRunState) {
  const message = artifact.errors.find((error) =>
    error.phase === "setup" || error.phase === "provider" || error.phase === "runner",
  )?.message;
  if (message) {
    const redacted = toRedactedJson(message);
    return (typeof redacted === "string" ? redacted : "Run failed.").slice(0, 1000);
  }
  return artifact.stopReasons.includes("aborted")
    ? "Provider run was aborted."
    : artifact.stopReasons.includes("error")
      ? "Provider run returned an error."
      : "Run failed.";
}
