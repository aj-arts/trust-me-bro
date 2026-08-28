import { ExperimentDetailView } from "@/components/experiments/experiment-detail-view";

type ExperimentPageProps = {
  params: Promise<{ experimentId: string }>;
};

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { experimentId } = await params;
  return <ExperimentDetailView experimentId={experimentId} />;
}
