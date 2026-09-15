import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow preview host
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
    ];
  },
};

export default nextConfig;
