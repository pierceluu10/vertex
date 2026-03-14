import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  transpilePackages: ["@heygen/streaming-avatar"],
};

export default nextConfig;
