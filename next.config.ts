import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev only: let phones on the same Wi-Fi open `pnpm dev` by the laptop's IP. Without
  // it the dev server blocks its live-reload socket from other origins, and pages never
  // become interactive (no QR code, forms fall back to plain HTML). No effect on builds.
  allowedDevOrigins: ["192.168.*.*"],
  experimental: {
    globalNotFound: true,
  },

  // Always revalidate the service worker so phones pick up a new one on their next visit.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "zuvsgspwhhirrfmhociv.supabase.co", pathname: "/storage/v1/object/public/avatars/**" },
    ],
  },
};

export default nextConfig;
