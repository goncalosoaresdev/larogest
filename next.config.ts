import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.68.103"],
  experimental: {
    serverActions: {
      bodySizeLimit: "40mb",
    },
    proxyClientMaxBodySize: "40mb",
  },
  serverExternalPackages: ["@react-pdf/renderer", "prisma", "@prisma/client", "@tuya/tuya-connector-nodejs"],
  async headers() {
    return [
      {
        source: "/casa/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
