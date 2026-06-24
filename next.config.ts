import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@earendil-works/pi-coding-agent"],
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
