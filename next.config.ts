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

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "zuvsgspwhhirrfmhociv.supabase.co", pathname: "/storage/v1/object/public/avatars/**" },
    ],
  },
};

export default nextConfig;
