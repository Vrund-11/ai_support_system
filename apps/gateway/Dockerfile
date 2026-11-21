# ── Stage 1: Build ──
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

COPY apps/gateway/package.json ./apps/gateway/
COPY apps/ticket-service/package.json ./apps/ticket-service/
COPY apps/notification-service/package.json ./apps/notification-service/
COPY apps/web/package.json ./apps/web/
COPY apps/widget/package.json ./apps/widget/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/webhook-lambda/package.json ./apps/webhook-lambda/

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-lib/package.json ./packages/shared-lib/
COPY packages/validators/package.json ./packages/validators/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/api-client/package.json ./packages/api-client/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/

RUN pnpm --filter @supportpilot/gateway... build
RUN pnpm --filter @supportpilot/gateway deploy --prod /prod/gateway

# ── Stage 2: Production Runner ──
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init wget

USER node

COPY --chown=node:node --from=builder /prod/gateway /app

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
