import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output = a self-contained server bundle, so the Docker image for
  // the web app doesn't need the whole monorepo's node_modules at runtime.
  output: 'standalone',
};

export default nextConfig;
