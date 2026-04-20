#!/bin/bash
# Pre-deployment safety checks before pulling/deploying
# Usage: ./scripts/pre-deploy-check.sh

set -euo pipefail

VITALOOP_DIR="${1:-.}"
ERRORS=0
WARNINGS=0

log_error() {
    echo "❌ ERROR: $1" >&2
    ((ERRORS++))
}

log_warn() {
    echo "⚠️  WARNING: $1" >&2
    ((WARNINGS++))
}

log_info() {
    echo "ℹ️  $1"
}

cd "$VITALOOP_DIR"

log_info "=== Pre-Deployment Safety Checks ==="
echo ""

# 1. Git status check
log_info "Checking git status..."
if [[ -n $(git status --porcelain) ]]; then
    log_error "Git working tree is dirty. Commit or stash changes first:"
    git status --short
else
    log_info "✓ Git working tree clean"
fi
echo ""

# 2. Check if we're on main branch
log_info "Checking branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "staging" ]]; then
    log_error "Not on main or staging branch (currently on: $CURRENT_BRANCH)"
else
    log_info "✓ On branch: $CURRENT_BRANCH"
fi
echo ""

# 3. Check origin is reachable
log_info "Checking remote connectivity..."
if git ls-remote origin HEAD >/dev/null 2>&1; then
    log_info "✓ Remote 'origin' is reachable"
else
    log_error "Cannot reach remote 'origin'"
fi
echo ""

# 4. Check for local commits not pushed
log_info "Checking unpushed commits..."
LOCAL_COMMITS=$(git log origin/main..HEAD --oneline | wc -l)
if [[ $LOCAL_COMMITS -gt 0 ]]; then
    if [[ "${ALLOW_UNPUSHED_COMMITS:-0}" == "1" ]]; then
        log_warn "Found $LOCAL_COMMITS unpushed commits on this branch; continuing because ALLOW_UNPUSHED_COMMITS=1"
        git log origin/main..HEAD --oneline
    else
        log_error "Found $LOCAL_COMMITS unpushed commits on this branch"
        git log origin/main..HEAD --oneline
    fi
else
    log_info "✓ No unpushed commits"
fi
echo ""

# 5. Check build directory writeable
log_info "Checking build directories..."
for dir in "frontend/dist" "crm-mvc/publish"; do
    if [[ -d "$dir" ]]; then
        if [[ ! -w "$dir" ]]; then
            log_error "Directory $dir is not writeable"
        else
            log_info "✓ Directory $dir is writeable"
        fi
    fi
done
echo ""

# 6. Check disk space (if on server)
log_info "Checking disk space..."
if df -B 1G . >/dev/null 2>&1; then
    DISK_FREE=$(df -B 1G . | tail -1 | awk '{print $4}')
else
    # macOS/BSD df fallback: -g reports values in GiB.
    DISK_FREE=$(df -g . | tail -1 | awk '{print $4}')
fi
if [[ $DISK_FREE -lt 2 ]]; then
    log_error "Low disk space: ${DISK_FREE}GB free (need >= 2GB)"
else
    log_info "✓ Disk space: ${DISK_FREE}GB available"
fi
echo ""

# 7. Environment variables check (if .env.production exists)
if [[ -f ".env.production" ]]; then
    log_info "Checking environment variables..."
    REQUIRED_VARS=("VITE_API_BASE_URL" "DATABASE_URL")
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" .env.production; then
            log_warn "Missing env var: $var in .env.production"
        else
            log_info "✓ Found $var"
        fi
    done
    echo ""
fi

# Final summary
echo "=== Summary ==="
if [[ $ERRORS -eq 0 ]]; then
    log_info "All checks passed! Safe to deploy."
    exit 0
else
    log_error "Found $ERRORS critical issue(s). Deploy blocked."
    [[ $WARNINGS -gt 0 ]] && log_warn "$WARNINGS warning(s) — review before proceeding"
    exit 1
fi
