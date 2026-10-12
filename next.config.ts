import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
