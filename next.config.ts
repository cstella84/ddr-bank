import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["spiffe"],
  turbopack: {
    resolveAlias: {
      spiffe: "./src/lib/spiffe-stub.js",
    },
  },
};

export default nextConfig;
