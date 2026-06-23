import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@trust-me-bro/benchmark"],
};

export default nextConfig;
