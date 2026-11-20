#!/usr/bin/env bash
# Stop dev datastores. Add -v to also remove volumes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../infra/docker/docker-compose.yml"

echo "🛑 Stopping SupportPilot datastores..."
docker compose -f "$COMPOSE_FILE" down "$@"
echo "✅ Done."
