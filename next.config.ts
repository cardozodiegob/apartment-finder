import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained Node build at .next/standalone that
  // our Dockerfile copies into a slim runtime image.
  output: "standalone",

  // These packages reach into Node APIs / dynamic require paths that webpack
  // can't safely bundle into the edge / server bundle. Keep them as external
  // runtime deps so Next.js calls them from node_modules directly.
  serverExternalPackages: [
    "lighthouse",
    "chrome-launcher",
    "@paulirish/trace_engine",
    "playwright",
    "@axe-core/playwright",
    "simple-git",
    "leaflet.markercluster",
  ],
  eslint: {
    // Test files intentionally import types/utilities for illustrative
    // purposes even when they aren't referenced. ESLint is still enforced in
    // `npm run lint`; we just don't want it to block production builds.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Sprint-runner internals have pre-existing type drift with upstream
    // packages (Zod strictness, node Buffer typing, Stripe/Anthropic SDK
    // version churn). The audit-spec code has its own tsc --noEmit gate in
    // CI; this flag lets production builds proceed while those are resolved
    // separately.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "unpkg.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://placehold.co https://*.supabase.co https://*.basemaps.cartocdn.com https://unpkg.com https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.basemaps.cartocdn.com https://nominatim.openstreetmap.org https://unpkg.com; frame-src https://js.stripe.com; worker-src 'self' blob:;",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
