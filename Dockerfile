# syntax=docker/dockerfile:1.7

# ----- Stage 1: deps --------------------------------------------------------
# Install npm dependencies in a separate layer so they only re-install when
# package.json / package-lock.json actually change.
FROM node:22-alpine AS deps
WORKDIR /app

# sharp (used by next/image) needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ----- Stage 2: build -------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args for NEXT_PUBLIC_* vars. These MUST be provided at build time
# because Next.js inlines `NEXT_PUBLIC_*` values into the client bundles during
# `next build` — they can't be overridden at runtime. Defaults are placeholders
# that let the build succeed when secrets aren't available (e.g. CI dry runs);
# docker-compose.yml passes the real values from .env.docker.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder

# A dummy MONGODB_URI and SUPABASE_SERVICE_ROLE_KEY keep the import chain happy
# during static-page generation. Real values arrive at runtime via compose env.
ENV MONGODB_URI=mongodb://placeholder:27017/placeholder \
    SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}

RUN npm run build

# ----- Stage 3: runtime -----------------------------------------------------
# Runs the standalone Next build under a non-root user with a built-in
# healthcheck hitting /api/health.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone server + public assets + static chunks produced by Next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
