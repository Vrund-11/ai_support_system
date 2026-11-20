# ── Stage 1: Build ──
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-lib/package.json ./packages/shared-lib/
COPY packages/validators/package.json ./packages/validators/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/ticket-service/package.json ./apps/ticket-service/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/ticket-service/ ./apps/ticket-service/

RUN pnpm --filter @supportpilot/ticket-service... build
RUN pnpm --filter @supportpilot/ticket-service deploy --prod /prod/ticket-service

# ── Stage 2: Production Runner ──
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init wget

USER node

COPY --chown=node:node --from=builder /prod/ticket-service /app

ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
