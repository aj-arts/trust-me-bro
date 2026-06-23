import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trust Me Bro — Agenty Security Benchmark",
  description:
    "A benchmark for testing whether coding agents can safely handle malicious instructions hidden in repo files, docs, and setup scripts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
