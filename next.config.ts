import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    const headers = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return [
      { source: "/email-approvals/:path*", headers },
      { source: "/api/email-approvals", headers },
    ];
  },
};

export default nextConfig;
