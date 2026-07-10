import type { NextConfig } from 'next';

/**
 * Two build shapes from one codebase:
 * - default: server build ('standalone') for the Docker/VPS deployment — API
 *   routes proxy to the live backend.
 * - STATIC_EXPORT=1: fully static site for GitHub Pages (free hosting). No API
 *   routes (the Pages workflow removes them pre-build); the demo replays a real
 *   recorded run (NEXT_PUBLIC_DEMO_MODE=recorded). basePath matches the project
 *   pages URL: https://<user>.github.io/beckn-data-commons/.
 */
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = staticExport
  ? {
      output: 'export',
      basePath: '/beckn-data-commons',
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      output: 'standalone',
    };

export default nextConfig;
