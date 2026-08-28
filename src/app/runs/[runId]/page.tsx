import { RunDetailView } from "@/components/experiments/run-detail-view";

type RunPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { runId } = await params;
  return <RunDetailView runId={runId} />;
}
