import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Trip photos carry a version in the query string (see src/lib/photos.ts), so a
    // replaced file is never served from the image cache under its old address.
    localPatterns: [{ pathname: "/images/**" }],
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
