import { notFound } from "next/navigation";
import { RunnerView } from "@/components/runner/runner-view";
import { getScenario } from "@/scenarios/registry";

type RunnerPageProps = {
  params: Promise<{
    scenarioId: string;
  }>;
};

export default async function RunnerPage({ params }: RunnerPageProps) {
  const { scenarioId } = await params;
  const scenario = getScenario(scenarioId);

  if (!scenario) {
    notFound();
  }

  return <RunnerView scenario={scenario} />;
}
