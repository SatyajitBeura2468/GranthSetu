import type { NextConfig } from "next";

const legacyOperatorPrefixes = [
  "catalogue",
  "circulation",
  "inventory",
  "members",
  "reports",
  "settings",
  "admin",
];

const nextConfig: NextConfig = {
  async redirects() {
    return legacyOperatorPrefixes.flatMap((prefix) => [
      {
        source: `/operator/${prefix}`,
        destination: "/operator",
        permanent: false,
      },
      {
        source: `/operator/${prefix}/:path*`,
        destination: "/operator",
        permanent: false,
      },
    ]);
  },
};

export default nextConfig;
