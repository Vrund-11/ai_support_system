# ── Stage 1: Build ──
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json .npmrc ./

COPY apps/gateway/package.json ./apps/gateway/
COPY apps/ticket-service/package.json ./apps/ticket-service/
COPY apps/notification-service/package.json ./apps/notification-service/
COPY apps/web/package.json ./apps/web/
COPY apps/widget/package.json ./apps/widget/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/webhook-lambda/package.json ./apps/webhook-lambda/
COPY apps/admin/package.json ./apps/admin/

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-lib/package.json ./packages/shared-lib/
COPY packages/validators/package.json ./packages/validators/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/queue/package.json ./packages/queue/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/notification-service/ ./apps/notification-service/

RUN pnpm --filter @supportpilot/notification-service... build
RUN pnpm --filter @supportpilot/notification-service deploy --legacy --prod /prod/notification-service

# ── Stage 2: Production Runner ──
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init wget

USER node

COPY --chown=node:node --from=builder /prod/notification-service /app

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
