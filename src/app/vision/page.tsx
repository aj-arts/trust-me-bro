import type { Metadata } from "next";
import { VisionView } from "@/components/vision/vision-view";

export const metadata: Metadata = {
  title: "The Vision · Trust Me Bro",
  description:
    "Why Trust Me Bro is a browser-native platform for testing coding-agent behavior and building an open security dataset.",
};

export default function VisionPage() {
  return <VisionView />;
}
