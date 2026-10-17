import type { NextConfig } from "next";

// The Sling API does not send CORS headers, so the browser talks to this app's
// own /sling/* path and Next.js forwards it server-side to the store's API.
const SLING_API_URL = (process.env.SLING_API_URL ?? "http://127.0.0.1:8000/users/book").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  async rewrites() {
    return [{ source: "/sling/:path*", destination: `${SLING_API_URL}/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
