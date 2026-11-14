import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trip pages read live data on every request (schedule, scores, trip phase),
  // so this app uses plain per-request rendering rather than Cache Components.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
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
