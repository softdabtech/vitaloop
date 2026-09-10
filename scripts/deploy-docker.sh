#!/bin/bash
# Docker-based production deployment
# Usage: ./scripts/deploy-docker.sh
#
# This script:
# 1. Builds Docker images locally
# 2. Pushes to production server
# 3. Recreates containers with new images
# 4. Verifies health checks

set -euo pipefail

# Configuration
REMOTE_HOST="${REMOTE_HOST:-softdab-server}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-vitaloop}"

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_error() { echo "❌ ERROR: $1" >&2; }
log_section() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "🐳 $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

cd "$(dirname "$0")/.."

# PHASE 1: Build Docker images locally
log_section "Phase 1: Build Docker Images"

log_info "Building backend image..."
docker build -t $IMAGE_PREFIX-backend:latest ./backend || {
    log_error "Failed to build backend image"
    exit 1
}
log_success "Backend image built: $IMAGE_PREFIX-backend:latest"

log_info "Building frontend image..."
docker build -t $IMAGE_PREFIX-frontend:latest ./frontend -f ./frontend/Dockerfile.prod || {
    log_error "Failed to build frontend image"
    exit 1
}
log_success "Frontend image built: $IMAGE_PREFIX-frontend:latest"

# PHASE 2: Deploy to production
log_section "Phase 2: Deploy to Production Server"

log_info "Syncing docker-compose.prod.yml to server..."
scp -q docker-compose.prod.yml "$REMOTE_HOST:$REMOTE_DIR/docker-compose.prod.yml" || {
    log_error "Failed to sync docker-compose.prod.yml"
    exit 1
}

log_info "Syncing Dockerfile.prod for frontend..."
scp -q frontend/Dockerfile.prod "$REMOTE_HOST:$REMOTE_DIR/frontend/Dockerfile.prod" || {
    log_error "Failed to sync frontend Dockerfile.prod"
    exit 1
}

# PHASE 3: Pull latest code and rebuild containers
log_section "Phase 3: Rebuild and Restart Containers"

ssh $REMOTE_HOST << 'DEPLOY_SCRIPT'
set -euo pipefail
cd /var/www/VITALOOP

echo "1️⃣ Pulling latest code..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code updated"

echo ""
echo "2️⃣ Stopping old containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
sleep 2
echo "✅ Containers stopped"

echo ""
echo "3️⃣ Building Docker images on server..."
docker compose -f docker-compose.prod.yml build --no-cache || {
    echo "ERROR: Docker build failed"
    exit 1
}
echo "✅ Images built"

echo ""
echo "4️⃣ Starting containers..."
docker compose -f docker-compose.prod.yml up -d || {
    echo "ERROR: Failed to start containers"
    exit 1
}
echo "✅ Containers started"

echo ""
echo "5️⃣ Waiting for health checks..."
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
        echo "✅ Containers healthy"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

echo ""
echo "6️⃣ Verifying services..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "7️⃣ Checking backend health..."
curl -s http://localhost:8004/health | head -c 100
echo ""

DEPLOY_SCRIPT

log_success "Deployment complete"

# PHASE 4: Validation
log_section "Phase 4: Post-Deployment Validation"

log_info "Checking backend health..."
if curl -sf https://api.vitaloop.today/health > /dev/null 2>&1; then
    log_success "Backend health check passed"
else
    log_error "Backend health check failed"
    exit 1
fi

log_info "Checking backend readiness..."
if curl -sf https://api.vitaloop.today/health/ready > /dev/null 2>&1; then
    log_success "Backend readiness check passed"
else
    log_error "Backend readiness check failed"
    exit 1
fi

log_info "Checking frontend..."
if curl -sf https://vitaloop.today > /dev/null 2>&1; then
    log_success "Frontend check passed"
else
    log_error "Frontend check failed"
    exit 1
fi

log_info "Checking landing page images actually resolve (not just index.html)..."
# 2026-09-10 incident: index.html and the health check both looked fine while
# two <img> paths on the landing page 404'd for days — the bundle referenced
# filenames that don't exist under public/mockups/. Catch that class of bug
# here instead of relying on someone eyeballing the homepage.
LANDING_JS_URL=$(curl -sf https://vitaloop.today/ | grep -oE '/assets/index-[A-Za-z0-9]+\.js' | head -1)
if [ -z "$LANDING_JS_URL" ]; then
    log_error "Could not find main JS bundle in homepage HTML"
    exit 1
fi
LANDING_CHUNK=$(curl -sf "https://vitaloop.today$LANDING_JS_URL" | grep -oE 'Landing-[A-Za-z0-9]+\.js' | head -1)
if [ -n "$LANDING_CHUNK" ]; then
    IMG_PATHS=$(curl -sf "https://vitaloop.today/assets/$LANDING_CHUNK" | grep -oE '/mockups/[A-Za-z0-9_-]+/[A-Za-z0-9._-]+\.webp' | sort -u)
    IMG_FAIL=0
    for p in $IMG_PATHS; do
        code=$(curl -s -o /dev/null -w "%{http_code}" "https://vitaloop.today$p")
        if [ "$code" != "200" ]; then
            log_error "Landing image $p returned HTTP $code"
            IMG_FAIL=1
        fi
    done
    if [ "$IMG_FAIL" = "1" ]; then
        exit 1
    fi
    log_success "Landing page images resolve (checked: $(echo "$IMG_PATHS" | wc -l | tr -d ' '))"
else
    log_warn "Could not locate Landing bundle chunk — skipping image check"
fi

echo ""
log_success "🎉 Docker deployment successful! All services healthy."
