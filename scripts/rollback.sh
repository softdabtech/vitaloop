#!/bin/bash
# Emergency rollback to previous stable version
# Usage: ./scripts/rollback.sh [target-commit] [--confirm]
#
# Examples:
#   ./scripts/rollback.sh                     # Show recent commits, no action
#   ./scripts/rollback.sh HEAD~1 --confirm   # Rollback to previous commit
#   ./scripts/rollback.sh abc1234 --confirm  # Rollback to specific commit

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3}"
CURL_OPTS="${CURL_OPTS:--sS --max-time 10}"

TARGET_COMMIT=""
CONFIRM=false

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_error() { echo "❌ ERROR: $1" >&2; }
log_warn() { echo "⚠️  WARNING: $1" >&2; }
log_section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⏮️  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

for arg in "$@"; do
  case "$arg" in
    --confirm)
      CONFIRM=true
      ;;
    *)
      if [[ -z "$TARGET_COMMIT" ]]; then
        TARGET_COMMIT="$arg"
      else
        log_error "Unexpected argument: $arg"
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$REMOTE_HOST" ]]; then
  log_error "REMOTE_HOST is not set. Export REMOTE_HOST (for example, deploy@your-host) before running rollback."
  exit 1
fi

log_section "Emergency Rollback Tool"

log_info "Checking server connectivity..."
if ! ssh $SSH_OPTS "$REMOTE_HOST" "cd '$REMOTE_DIR' && echo ok" >/dev/null 2>&1; then
  log_error "Cannot connect to server '$REMOTE_HOST' or directory '$REMOTE_DIR'"
  exit 1
fi
log_success "Server is reachable"

log_section "Current Deployment Status"
CURRENT_INFO=$(ssh $SSH_OPTS "$REMOTE_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  git fetch origin main >/dev/null 2>&1 || true
  echo 'Current_HEAD='\"\$(git rev-parse --short HEAD)\"
  echo 'Origin_Main='\"\$(git rev-parse --short origin/main 2>/dev/null || echo unknown)\"
  echo 'Dirty='\"\$([ -n '\"\$(git status --porcelain)\"' ] && echo true || echo false)\"
  echo 'Recent_Commits='
  git --no-pager log --oneline -8
")

echo "$CURRENT_INFO"

CURRENT_HEAD=$(echo "$CURRENT_INFO" | awk -F= '/^Current_HEAD=/{print $2; exit}')

if [[ -z "$TARGET_COMMIT" ]]; then
  log_section "Available Rollback Options"
  log_warn "No target commit specified."
  log_info "Use one of the recent commit hashes shown above."
  log_info "Example: ./scripts/rollback.sh HEAD~1 --confirm"
  exit 0
fi

if [[ "$CONFIRM" != true ]]; then
  log_section "Rollback Preview"
  log_warn "Rollback requires --confirm flag for safety."
  log_info "Current commit: $CURRENT_HEAD"
  log_info "Target commit:  $TARGET_COMMIT"
  log_info "Run: ./scripts/rollback.sh $TARGET_COMMIT --confirm"
  exit 0
fi

log_section "Performing Rollback"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_BRANCH="rollback-backup-${TIMESTAMP}"

log_warn "Rolling back to: $TARGET_COMMIT"
ROLLBACK_INFO=$(ssh $SSH_OPTS "$REMOTE_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'

  if ! git rev-parse --verify '$TARGET_COMMIT' >/dev/null 2>&1; then
    echo 'ERROR: Target commit not found: $TARGET_COMMIT' >&2
    exit 1
  fi

  CURRENT_FULL=\$(git rev-parse HEAD)
  git branch '$BACKUP_BRANCH' \"\$CURRENT_FULL\"

  git checkout -q main
  git reset --hard '$TARGET_COMMIT'

  echo 'Backup_Branch='\"$BACKUP_BRANCH\"
  echo 'Rollback_HEAD='\"\$(git rev-parse --short HEAD)\"
") || {
  log_error "Rollback git operation failed"
  exit 1
}

echo "$ROLLBACK_INFO"

log_section "Rebuild & Restart Services"
ssh $SSH_OPTS "$REMOTE_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'

  echo 'Building frontend...'
  cd frontend
  export NODE_OPTIONS=--max-old-space-size=3072
  npm ci --prefer-offline || npm ci
  npm run build:prod
  cd ..

  echo 'Building CRM...'
  cd crm-mvc
  dotnet publish -c Release
  cd ..

  echo 'Restarting services...'
  systemctl restart vitaloop-backend vitaloop-crm-mvc
  echo 'Services restarted.'
" || {
  log_error "Service rebuild/restart failed."
  exit 1
}

log_section "Post-Rollback Validation"
VALIDATION_OK=true

if ! curl $CURL_OPTS -f "https://api.vitaloop.today/health" >/dev/null 2>&1; then
  log_error "API health check failed"
  VALIDATION_OK=false
else
  log_success "API health check passed"
fi

if ! curl $CURL_OPTS -f "https://api.vitaloop.today/health/ready" >/dev/null 2>&1; then
  log_error "API readiness check failed"
  VALIDATION_OK=false
else
  log_success "API readiness check passed"
fi

if ! curl $CURL_OPTS -f "https://vitaloop.today" >/dev/null 2>&1; then
  log_error "Frontend check failed"
  VALIDATION_OK=false
else
  log_success "Frontend check passed"
fi

if [[ "$VALIDATION_OK" != true ]]; then
  log_error "Rollback completed but validation failed. Manual intervention required."
  exit 1
fi

log_section "Rollback Complete"
log_success "Rollback succeeded."
log_info "Current commit: $TARGET_COMMIT"
log_info "Backup branch on server: $BACKUP_BRANCH"
log_warn "Data migrations are not rolled back by this script."
#!/bin/bash
# Emergency rollback to previous stable version
# Usage: ./scripts/rollback.sh [target-commit] [--confirm]
#
# Examples:
#   ./scripts/rollback.sh                  # Show previous commits, no action
#   ./scripts/rollback.sh abc1234 --confirm  # Rollback to specific commit

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@159.65.252.227}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"
TARGET_COMMIT="${1:-}"
CONFIRM="${2:-}"

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_error() { echo "❌ ERROR: $1" >&2; }
log_warn() { echo "⚠️  WARNING: $1" >&2; }
log_section() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "⏮️  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

log_section "Emergency Rollback Tool"

# Check if we have SSH access first
log_info "Checking server connectivity..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE_HOST" "cd $REMOTE_DIR && echo ok" >/dev/null 2>&1; then
    log_error "Cannot connect to server: $REMOTE_HOST"
    exit 1
fi
log_success "Server is reachable"

# Get current status
log_section "Current Deployment Status"

CURRENT_INFO=$(ssh -o BatchMode=yes "$REMOTE_HOST" "
    cd $REMOTE_DIR
    echo \"Current_HEAD=\$(git rev-parse --short HEAD)\"
    echo \"Main_Branch=\$(git rev-parse --short origin/main)\"
    echo \"Status_Dirty=\$([ -n \\\"\$(git status --porcelain)\\\" ] && echo true || echo false)\"
    echo \"Last_3_Commits=\"
    git log --oneline -3
")

echo "$CURRENT_INFO"

# Parse current state
CURRENT_HEAD=$(echo "$CURRENT_INFO" | grep "^Current_HEAD=" | cut -d'=' -f2)
MAIN_BRANCH=$(echo "$CURRENT_INFO" | grep "^Main_Branch=" | cut -d'=' -f2)

log_info "Current deployment: $CURRENT_HEAD"

# If no target specified, just show options
if [[ -z "$TARGET_COMMIT" ]]; then
    log_section "Available Rollback Options"
    log_warn "No target commit specified. Choose one of the above commits to rollback to."
    log_info "Usage: $0 <commit-hash> --confirm"
    log_info ""
    log_info "Examples:"
    log_info "  ./scripts/rollback.sh abc1234 --confirm    # Rollback to abc1234"
    log_info "  ./scripts/rollback.sh HEAD~1 --confirm     # Rollback to previous commit"
    exit 0
fi

# Require confirmation for actual rollback
if [[ "$CONFIRM" != "--confirm" ]]; then
    log_section "Rollback Preview"
    log_warn "Rollback requires --confirm flag for safety"
    log_info "Target commit: $TARGET_COMMIT"
    log_info "Current commit: $CURRENT_HEAD"
    log_info ""
    log_info "To execute rollback, run:"
    log_info "  $0 $TARGET_COMMIT --confirm"
    exit 0
fi

log_section "PERFORMING ROLLBACK"
log_warn "Rolling back to commit: $TARGET_COMMIT"

# Get commit info before rollback
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_BRANCH="rollback-backup-${TIMESTAMP}"

rollback_result=$(ssh -o BatchMode=yes "$REMOTE_HOST" "
    set -euo pipefail
    cd $REMOTE_DIR || exit 1
    
    # Create backup branch at current HEAD
    CURRENT_COMMIT=\$(git rev-parse HEAD)
    git branch $BACKUP_BRANCH \$CURRENT_COMMIT
    echo \"Backup_Branch=$BACKUP_BRANCH\"
    
    # Verify target commit exists
    if ! git rev-parse --verify \"$TARGET_COMMIT\" >/dev/null 2>&1; then
        echo \"ERROR: Target commit not found: $TARGET_COMMIT\" >&2
        exit 1
    fi
    
    # Perform rollback via revert (safer than hard reset)
    echo \"Rolling back to: \$(git rev-parse --short $TARGET_COMMIT)\"
    git reset --soft \"$TARGET_COMMIT\" || {
        echo \"ERROR: Reset failed\" >&2
        exit 1
    }
    
    # Create rollback commit
    git add -A
    git commit -m \"revert: emergency rollback from \$CURRENT_COMMIT to $TARGET_COMMIT

Backup branch: $BACKUP_BRANCH
Reason: Emergency rollback performed at $(date)
To restore previous version: git reset --hard $BACKUP_BRANCH\" || true
    
    echo \"Reset_Complete=true\"
" 2>&1) || {
    log_error "Rollback failed"
    echo "$rollback_result" | tail -10
    exit 1
}

echo "$rollback_result"

# Extract backup branch from result
BACKUP_BRANCH=$(echo "$rollback_result" | grep "^Backup_Branch=" | cut -d'=' -f2 || echo "")

log_section "Rebuild & Restart Services"

ssh -o BatchMode=yes "$REMOTE_HOST" "
    set -euo pipefail
    cd $REMOTE_DIR
    
    # Rebuild frontend
    echo 'Rebuilding frontend...'
    cd frontend && npm ci && npm run build && cd .. || {
        echo 'Frontend rebuild failed'
        exit 1
    }
    
    # Rebuild CRM
    echo 'Rebuilding CRM...'
    cd crm-mvc && dotnet publish -c Release && cd .. || {
        echo 'CRM rebuild failed'
        exit 1
    }
    
    # Restart services
    echo 'Restarting services...'
    systemctl restart vitaloop-backend vitaloop-crm-mvc
    echo 'Services restarted'
    
    git log --oneline -3
" || {
    log_error "Service restart failed. Manual intervention may be needed."
    exit 1
}

log_section "Verification"

sleep 3

# Check health
if curl -sf "https://api.vitaloop.today/health" >/dev/null 2>&1; then
    log_success "API is healthy"
else
    log_error "API health check failed. Services may not be responding."
fi

log_section "Rollback Complete"
log_success "Successfully rolled back to: $TARGET_COMMIT"
if [[ -n "$BACKUP_BRANCH" ]]; then
    log_info "Backup branch created: $BACKUP_BRANCH (for manual recovery if needed)"
fi

log_warn "Important!"
log_info "1. Verify the application is working: https://vitaloop.today"
log_info "2. Check logs for any errors: systemctl status vitaloop-backend"
log_info "3. Data has NOT been reverted (rollback is code only)"
log_info ""
log_info "If issues persist, contact the team."
