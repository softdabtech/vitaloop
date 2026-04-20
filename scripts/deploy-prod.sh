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
RSYNC_OPTS="${RSYNC_OPTS:--az --delete}"

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

REMOTE_CURRENT_HEAD=$(ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && git rev-parse HEAD" 2>/dev/null || true)
DEPLOY_CHANGED_FILES="$(git diff --name-only "$REMOTE_CURRENT_HEAD" HEAD 2>/dev/null || git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || true)"
HAS_FRONTEND_CHANGES=0
HAS_BACKEND_CHANGES=0

if echo "$DEPLOY_CHANGED_FILES" | grep -qE '^frontend/'; then
    HAS_FRONTEND_CHANGES=1
fi

if echo "$DEPLOY_CHANGED_FILES" | grep -qE '^backend/'; then
    HAS_BACKEND_CHANGES=1
fi

# PHASE 1: Local pre-deploy checks
log_section "Phase 1: Pre-Deployment Checks"

if [[ ! -x ./scripts/pre-deploy-check.sh ]]; then
    log_error "Missing executable pre-deploy check script: ./scripts/pre-deploy-check.sh"
    exit 1
fi

if ! ALLOW_UNPUSHED_COMMITS=1 ./scripts/pre-deploy-check.sh; then
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
CURRENT_COMMIT_FULL=$(git rev-parse HEAD)
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
    
    # Fast-forward only (no force merges)
    git pull --ff-only origin main || {
        echo 'ERROR: Could not fast-forward. Manual intervention required.'
        exit 1
    }

    if git diff --name-only ORIG_HEAD HEAD 2>/dev/null | grep -qE '^backend/'; then
        echo 'Installing backend dependencies...'
        cd backend
        ./.venv/bin/pip install -r requirements.txt || {
            echo 'ERROR: Backend dependency install failed'
            exit 1
        }
        cd ..
    else
        echo 'Skipping backend dependency install (no backend changes)'
    fi
    
    echo 'Git pull successful'
" || {
    log_error "Failed to pull code on server"
    exit 1
}
log_success "Code pulled to server"

# PHASE 5: Build & restart services
log_section "Phase 5: Build & Restart Services"

if [[ "$HAS_FRONTEND_CHANGES" == "1" ]]; then
    log_info "Building frontend locally..."
    (
        cd frontend
        npm ci --prefer-offline || npm ci
        NODE_OPTIONS='--max-old-space-size=2048' npm run build:prod
        printf '%s' "$CURRENT_COMMIT_FULL" > dist/.build_commit
    ) || {
        log_error "Local frontend build failed"
        exit 1
    }

    log_info "Syncing frontend dist to server..."
    rsync $RSYNC_OPTS frontend/dist/ "$REMOTE_HOST:$REMOTE_DIR/frontend/dist/" || {
        log_error "Failed to sync frontend dist to server"
        exit 1
    }
    log_success "Frontend artifact synced to server"
else
    log_info "Skipping local frontend build (no frontend changes detected)"
fi

ssh $SSH_OPTS "$REMOTE_HOST" "
    set -euo pipefail
    cd $REMOTE_DIR
    
    CHANGED_FILES=\"\$(git diff --name-only ORIG_HEAD HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || true)\"
    
    # CRM build (only when CRM files changed)
    if echo \"\$CHANGED_FILES\" | grep -qE '^crm-mvc/'; then
        echo 'Building CRM...'
        cd crm-mvc
        dotnet publish Vitaloop.Crm.Web.csproj -c Release -o "$REMOTE_DIR/crm-mvc/publish" || {
            echo 'ERROR: CRM build failed'
            exit 1
        }
        cd ..
    else
        echo 'Skipping CRM build (no crm changes)'
    fi
    
    # Restart services
    RESTART_BACKEND=0
    RESTART_CRM=0
    if echo "\$CHANGED_FILES" | grep -qE '^backend/'; then
        RESTART_BACKEND=1
    fi
    if echo "\$CHANGED_FILES" | grep -qE '^crm-mvc/'; then
        RESTART_CRM=1
    fi

    if [[ "\$RESTART_BACKEND" == "1" && "\$RESTART_CRM" == "1" ]]; then
        echo 'Restarting services: vitaloop-backend vitaloop-crm-mvc'
        systemctl restart vitaloop-backend vitaloop-crm-mvc || {
            echo 'ERROR: Service restart failed'
            exit 1
        }
        echo 'Services restarted successfully'
    elif [[ "\$RESTART_BACKEND" == "1" ]]; then
        echo 'Restarting services: vitaloop-backend'
        systemctl restart vitaloop-backend || {
            echo 'ERROR: Service restart failed'
            exit 1
        }
        echo 'Services restarted successfully'
    elif [[ "\$RESTART_CRM" == "1" ]]; then
        echo 'Restarting services: vitaloop-crm-mvc'
        systemctl restart vitaloop-crm-mvc || {
            echo 'ERROR: Service restart failed'
            exit 1
        }
        echo 'Services restarted successfully'
    else
        echo 'No service restart required'
    fi
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

if [[ "$HAS_BACKEND_CHANGES" == "1" ]]; then
    log_info "Checking live backend runtime version..."
    LIVE_BACKEND_COMMIT=$(curl $CURL_OPTS -f "https://api.vitaloop.today/health" 2>/dev/null | python3 -c 'import json,sys; print((json.load(sys.stdin).get("build") or {}).get("commit", ""))' || true)
    if [[ "$LIVE_BACKEND_COMMIT" != "$CURRENT_COMMIT_FULL" ]]; then
        log_error "Backend runtime version mismatch (live=$LIVE_BACKEND_COMMIT expected=$CURRENT_COMMIT_FULL)"
        VALIDATION_PASSED=false
    else
        log_success "Backend runtime version matches deployed commit"
    fi
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

if [[ "${RUN_RATE_LIMIT_SMOKE:-0}" == "1" ]]; then
    log_info "Checking API rate limiter smoke..."
    if ! ./scripts/smoke_rate_limiter.sh > /dev/null 2>&1; then
        log_error "API rate limiter smoke check failed"
        VALIDATION_PASSED=false
    else
        log_success "API rate limiter smoke check passed"
    fi
else
    log_info "Skipping API rate limiter smoke (set RUN_RATE_LIMIT_SMOKE=1 to enable)"
fi

# Check frontend
log_info "Checking frontend endpoint..."
if ! curl $CURL_OPTS -f "https://vitaloop.today" > /dev/null 2>&1; then
    log_error "Frontend health check failed"
    VALIDATION_PASSED=false
else
    log_success "Frontend health check passed"
fi

if [[ "$HAS_FRONTEND_CHANGES" == "1" ]]; then
    log_info "Checking live frontend artifact version..."
    LIVE_BUILD_COMMIT=$(curl $CURL_OPTS -f "https://vitaloop.today/build-info.json" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("commit", ""))' || true)
    if [[ "$LIVE_BUILD_COMMIT" != "$CURRENT_COMMIT_FULL" ]]; then
        log_error "Frontend artifact version mismatch (live=$LIVE_BUILD_COMMIT expected=$CURRENT_COMMIT_FULL)"
        VALIDATION_PASSED=false
    else
        log_success "Frontend artifact version matches deployed commit"
    fi
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
