import type { NextConfig } from "next";

const API = process.env.API_ORIGIN ?? "http://localhost:4000";

const config: NextConfig = {
  transpilePackages: ["@pp/shared"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Same-origin API: the refresh cookie stays SameSite=Strict and no CORS is needed in the browser.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};
export default config;
