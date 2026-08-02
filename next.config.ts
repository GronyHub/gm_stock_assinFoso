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
};

export default nextConfig;
