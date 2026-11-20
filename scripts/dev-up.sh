#!/usr/bin/env bash
# Start dev datastores and initialize MinIO bucket.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../infra/docker/docker-compose.yml"

echo "🚀 Starting SupportPilot datastores..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "✅ Dev datastores ready:"
echo "   MongoDB     → localhost:27017"
echo "   Postgres    → localhost:5432  (user: supportpilot)"
echo "   Redis       → localhost:6379"
echo "   MinIO S3    → localhost:9000  (console: localhost:9001)"
echo "   MailHog     → localhost:8025  (SMTP: localhost:1025)"
