# syntax=docker/dockerfile:1.7

# ----- Stage 1: deps --------------------------------------------------------
# Install npm dependencies in a separate layer so they only re-install when
# package.json / package-lock.json actually change.
FROM node:20-alpine AS deps
WORKDIR /app

# sharp (used by next/image) needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ----- Stage 2: build -------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The Next build needs at least a dummy MONGODB_URI so that the import chain
# parsed at build time doesn't crash. Real value comes in at runtime.
ENV MONGODB_URI=mongodb://placeholder:27017/placeholder
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ENV SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key

RUN npm run build

# ----- Stage 3: runtime -----------------------------------------------------
# Runs the standalone Next build under a non-root user with a built-in
# healthcheck hitting /api/health.
FROM node:20-alpine AS runner
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
