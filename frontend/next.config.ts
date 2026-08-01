import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js — keeps the
  // production Docker image small (no node_modules copy).
  output: "standalone",
  // Pin the trace root to this directory. Otherwise Next walks up looking for a
  // lockfile and can land outside the repo, which nests server.js under a path
  // mirror (.next/standalone/<...>/frontend/server.js) and breaks the Dockerfile COPY.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
