#!/bin/bash
# Production deployment orchestrator with safety checks
# Usage: ./scripts/deploy-prod.sh [--force] [--no-backup]

set -euo pipefail

FORCE_DEPLOY=false
CREATE_BACKUP=true
DEPLOY_DIR="${DEPLOY_DIR:-.}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3}"
CURL_OPTS="${CURL_OPTS:--sS --max-time 10}"

log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ ERROR: $1" >&2
}

log_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE_DEPLOY=true; shift ;;
        --no-backup) CREATE_BACKUP=false; shift ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

cd "$DEPLOY_DIR"

if [[ -z "$REMOTE_HOST" ]]; then
    log_error "REMOTE_HOST is not set. Export REMOTE_HOST (for example, deploy@your-host) before running deploy."
    exit 1
fi

# PHASE 1: Local pre-deploy checks
log_section "Phase 1: Pre-Deployment Checks"

if [[ ! -x ./scripts/pre-deploy-check.sh ]]; then
    log_error "Missing executable pre-deploy check script: ./scripts/pre-deploy-check.sh"
    exit 1
fi

if ! ./scripts/pre-deploy-check.sh; then
    if [[ "$FORCE_DEPLOY" != "true" ]]; then
        log_error "Pre-deployment checks failed. Use --force to override."
        exit 1
    else
        log_error "Pre-deployment checks failed, but --force specified. Proceeding..."
    fi
fi
log_success "Pre-deployment checks passed"

# PHASE 2: Push to GitHub
log_section "Phase 2: Push to GitHub"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
log_info "Pushing commit $CURRENT_COMMIT to origin/main"

git push origin main || {
    log_error "Failed to push to GitHub"
    exit 1
}
log_success "Successfully pushed to GitHub"

# PHASE 3: Server pre-deployment (backup existing state)
if [[ "$CREATE_BACKUP" == "true" ]]; then
    log_section "Phase 3: Create Server Backup Branch"
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_BRANCH="backup-prod-${TIMESTAMP}"
    
    log_info "Creating backup branch: $BACKUP_BRANCH"
    ssh $SSH_OPTS "$REMOTE_HOST" "
        set -euo pipefail
        cd $REMOTE_DIR
        
        # Stash any local changes
        if [[ -n \$(git status --porcelain) ]]; then
            git stash push -u -m 'pre-deploy-${TIMESTAMP}'
        fi
        
        # Create backup branch from current HEAD
        CURRENT_HEAD=\$(git rev-parse HEAD)
        git branch $BACKUP_BRANCH \$CURRENT_HEAD
        echo \"Backup branch created: $BACKUP_BRANCH at \$CURRENT_HEAD\"
    " || {
        log_error "Failed to create backup branch on server"
        exit 1
    }
    log_success "Backup branch created: $BACKUP_BRANCH"
else
    log_section "Phase 3: Skipping Backup (--no-backup)"
fi

# PHASE 4: Deployment to server
log_section "Phase 4: Pull & Deploy to Production"

log_info "Pulling latest code to server..."
ssh $SSH_OPTS "$REMOTE_HOST" "
    set -euo pipefail
    cd $REMOTE_DIR

    # Backend dependency sync
    echo 'Installing backend dependencies...'
    cd backend
    ./.venv/bin/pip install -r requirements.txt || {
        echo 'ERROR: Backend dependency install failed'
        exit 1
    }
    cd ..
    
    # Fast-forward only (no force merges)
    git pull --ff-only origin main || {
        echo 'ERROR: Could not fast-forward. Manual intervention required.'
        exit 1
    }
    
    echo 'Git pull successful'
" || {
    log_error "Failed to pull code on server"
    exit 1
}
log_success "Code pulled to server"

# PHASE 5: Build & restart services
log_section "Phase 5: Build & Restart Services"

ssh $SSH_OPTS "$REMOTE_HOST" "
    set -euo pipefail
    cd $REMOTE_DIR
    
    CHANGED_FILES=\"\$(git diff --name-only ORIG_HEAD HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || true)\"

    # Frontend build (only when frontend files changed)
    if echo \"\$CHANGED_FILES\" | grep -qE '^(frontend/|frontend/package.json|frontend/package-lock.json)$'; then
        echo 'Building frontend...'
        cd frontend
        npm ci --prefer-offline || npm ci
        # Use build:prod to avoid npm postbuild hooks (react-snap) on headless servers.
        NODE_OPTIONS='--max-old-space-size=2048' npm run build:prod || {
            echo 'ERROR: Frontend build failed'
            exit 1
        }
        cd ..
    else
        echo 'Skipping frontend build (no frontend changes)'
    fi
    
    # CRM build (only when CRM files changed)
    if echo \"\$CHANGED_FILES\" | grep -qE '^crm-mvc/'; then
        echo 'Building CRM...'
        cd crm-mvc
        dotnet publish -c Release || {
            echo 'ERROR: CRM build failed'
            exit 1
        }
        cd ..
    else
        echo 'Skipping CRM build (no crm changes)'
    fi
    
    # Restart services
    echo 'Restarting services...'
    systemctl restart vitaloop-backend vitaloop-crm-mvc || {
        echo 'ERROR: Service restart failed'
        exit 1
    }
    
    echo 'Services restarted successfully'
" || {
    log_error "Failed to build or restart services"
    exit 1
}
log_success "Build completed and services restarted"

# PHASE 6: Validation
log_section "Phase 6: Post-Deployment Validation"

# Give services time to start and warm up before external health checks.
for i in {1..30}; do
    if curl $CURL_OPTS -f "https://api.vitaloop.today/health" > /dev/null 2>&1 \
        && curl $CURL_OPTS -f "https://api.vitaloop.today/health/ready" > /dev/null 2>&1; then
                break
        fi
        sleep 2
done

VALIDATION_PASSED=true

# Check /health
log_info "Checking API health endpoint..."
if ! curl $CURL_OPTS -f "https://api.vitaloop.today/health" > /dev/null 2>&1; then
    log_error "API health check failed"
    VALIDATION_PASSED=false
else
    log_success "API health check passed"
fi

# Check /health/ready
log_info "Checking API readiness endpoint..."
if ! curl $CURL_OPTS -f "https://api.vitaloop.today/health/ready" > /dev/null 2>&1; then
    log_error "API readiness check failed"
    VALIDATION_PASSED=false
else
    log_success "API readiness check passed"
fi

log_info "Checking API security headers..."
if ! ./scripts/smoke_api_security_headers.sh > /dev/null 2>&1; then
    log_error "API security header smoke check failed"
    VALIDATION_PASSED=false
else
    log_success "API security header smoke check passed"
fi

# Check frontend
log_info "Checking frontend endpoint..."
if ! curl $CURL_OPTS -f "https://vitaloop.today" > /dev/null 2>&1; then
    log_error "Frontend health check failed"
    VALIDATION_PASSED=false
else
    log_success "Frontend health check passed"
fi

# Check CRM
log_info "Checking CRM endpoint..."
STATUS=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "https://crm.vitaloop.today" || echo "000")
if [[ "$STATUS" == "302" ]]; then
    log_success "CRM health check passed (302 redirect)"
elif [[ "$STATUS" == "200" ]]; then
    log_success "CRM health check passed (200)"
else
    log_error "CRM health check failed (HTTP $STATUS)"
    VALIDATION_PASSED=false
fi

# Final status
echo ""
if [[ "$VALIDATION_PASSED" == "true" ]]; then
    log_success "🎉 Deployment completed successfully!"
    log_info "All endpoints are healthy and services are running"
    exit 0
else
    log_error "❌ Some validation checks failed. Review logs above."
    exit 1
fi
