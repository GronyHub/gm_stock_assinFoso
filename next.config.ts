import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The deploy builds into a separate folder (NEXT_DIST_DIR=.next-build) while the live site keeps
  // serving from .next, then swaps the folders, so a build never takes the site down.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['web-push'],
  // Without this, /sw.js is just a normal static file and can sit in a
  // browser's HTTP cache for a while -- a shipped service-worker fix (like
  // the fetch-passthrough one) can then silently fail to reach an already-
  // visited device for hours, even though skipWaiting()/clients.claim() in
  // the worker itself are ready to take over the instant the browser
  // actually re-checks. Forcing revalidation on every request is what makes
  // that re-check happen on the very next page load instead.
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  // Enable output file tracing to reduce deployment bundle size and speed up builds
  outputFileTracingRoot: undefined,
  // The Droplet's build ran out of memory in the TypeScript step on 2026-10-22 (the heap limit is
  // about 480 MB and the item page alone is 600 KB). Types are checked with `npx tsc --noEmit`
  // before every push instead, so the production build does not repeat that check.
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
