Write-Host "=== DOCKER IMAGES (OLD VS NEW & STALE REMOVAL) ==="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}"

Write-Host "`n=== CONTAINER STATUS & HEALTH ==="
docker compose -f infra/docker-compose.yml ps

Write-Host "`n=== CONTAINER HEALTH INSPECTIONS ==="
docker inspect --format '{{.Name}}: {{.State.Health.Status}} (streak={{.State.Health.FailingStreak}})' sp-web sp-widget sp-ai-service

Write-Host "`n=== WIDGET HTTP HEADERS (PORT 3001) ==="
curl.exe -I http://localhost:3001

Write-Host "`n=== WIDGET BUNDLE (PORT 3001 /widget.js) ==="
curl.exe -I http://localhost:3001/widget.js

Write-Host "`n=== WIDGET JS CONTENT PREVIEW (FIRST 3 LINES) ==="
curl.exe -s http://localhost:3001/widget.js | Select-Object -First 3

Write-Host "`n=== WEB HEALTH & HEADERS (PORT 3000) ==="
curl.exe -I http://localhost:3000

Write-Host "`n=== AI-SERVICE HEALTH (PORT 8000) ==="
curl.exe -s http://localhost:8000/health
Write-Host ""
