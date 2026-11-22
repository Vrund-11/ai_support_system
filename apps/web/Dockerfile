# ── Stage 1: Build ──
FROM node:26-alpine AS builder

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

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm --filter @supportpilot/web... build

# ── Stage 2: Production Nginx Runner ──
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
