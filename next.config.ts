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
  poweredByHeader: false,
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const connectSources = ["'self'", supabaseOrigin, supabaseOrigin?.replace(/^https:/, "wss:")].filter(Boolean).join(" ");
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSources}`,
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    ] }];
  },
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
