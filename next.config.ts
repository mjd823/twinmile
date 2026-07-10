import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          // https://twinmile.com so the branded email preview iframes
          // (srcdoc inherits this CSP) can load the logo when the admin is
          // viewed from localhost or a preview deploy.
          "img-src 'self' data: blob: https://twinmile.com",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          isProd
            ? "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
          "connect-src 'self' https://analytics.google.com https://www.google.com https://www.googletagmanager.com",
          "form-action 'self'",
        ].join("; "),
      },
    ] as { key: string; value: string }[];

    if (isProd) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;
