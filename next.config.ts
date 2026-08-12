import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Skip validation that can slow down builds
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
};

export default nextConfig;
