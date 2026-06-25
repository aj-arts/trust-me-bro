import type { Metadata } from "next";
import { VisionView } from "@/components/vision/vision-view";

export const metadata: Metadata = {
  title: "The Vision · Trust Me Bro",
  description:
    "Why we built a benchmark for whether AI coding agents can resist hidden malicious instructions — and where it's headed.",
};

export default function VisionPage() {
  return <VisionView />;
}
