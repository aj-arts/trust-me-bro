import type { GenericId } from "convex/values";
import { RunDetailView } from "@/components/runs/run-detail-view";

type RunDetailPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;

  return <RunDetailView runId={runId as GenericId<"runs">} />;
}
