import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Trip photos carry a version in the query string (see src/lib/photos.ts), so a
    // replaced file is never served from the image cache under its old address.
    localPatterns: [{ pathname: "/images/**" }],
  },
  // The site once kept each trip under /t/<trip>. Links shared then still work.
  async redirects() {
    return [
      { source: "/t/:trip", destination: "/", permanent: true },
      { source: "/t/:trip/weather", destination: "/wind", permanent: true },
      { source: "/t/:trip/:path*", destination: "/:path*", permanent: true },
    ];
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
