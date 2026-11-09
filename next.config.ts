import type { NextConfig } from "next";

// Avatars are served by whichever Supabase project this build points at (dev for
// previews, prod for production), so allow that project's host rather than a fixed one.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
const supabaseHost = new URL(supabaseUrl).hostname;

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
    unoptimized: true,
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
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/avatars/**" },
    ],
  },
};

export default nextConfig;
