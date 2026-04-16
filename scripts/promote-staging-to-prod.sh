#!/bin/bash
# Staging environment promotion flow
# Usage: ./scripts/promote-staging-to-prod.sh [branch-name]
# Promotes code from staging branch to production after verification

set -euo pipefail

STAGING_BRANCH="${1:-staging}"
PROD_BRANCH="main"
DRY_RUN=false

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_error() { echo "❌ ERROR: $1" >&2; }
log_section() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "🚀 $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# Validate branch exists locally
if ! git show-ref --verify --quiet "refs/heads/$STAGING_BRANCH"; then
    log_error "Staging branch '$STAGING_BRANCH' does not exist"
    git branch --list
    exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$PROD_BRANCH"; then
    log_error "Production branch '$PROD_BRANCH' does not exist"
    exit 1
fi

log_section "Stage 1: Verify Staging Branch"

# Get commit info
STAGING_COMMIT=$(git rev-parse --short "$STAGING_BRANCH")
STAGING_COMMIT_LONG=$(git rev-parse "$STAGING_BRANCH")
STAGING_AUTHOR=$(git log -1 --format='%an' "$STAGING_BRANCH")
STAGING_DATE=$(git log -1 --format='%ai' "$STAGING_BRANCH")

log_info "Branch: $STAGING_BRANCH"
log_info "Latest commit: $STAGING_COMMIT ($STAGING_COMMIT_LONG)"
log_info "Author: $STAGING_AUTHOR"
log_info "Date: $STAGING_DATE"

# Show commits in staging not in main
log_section "Stage 2: Commits to Promote"

COMMITS_TO_PROMOTE=$(git log --oneline "$PROD_BRANCH..$STAGING_BRANCH" | wc -l)
if [[ $COMMITS_TO_PROMOTE -eq 0 ]]; then
    log_error "No new commits to promote from $STAGING_BRANCH to $PROD_BRANCH"
    exit 1
fi

log_info "Commits to promote: $COMMITS_TO_PROMOTE"
git log --oneline --graph "$PROD_BRANCH..$STAGING_BRANCH"

log_section "Stage 3: Run Tests (if available)"

# Try to run tests if script exists
if [[ -f "./scripts/test.sh" ]]; then
    log_info "Running test suite..."
    if ./scripts/test.sh; then
        log_success "All tests passed ✓"
    else
        log_error "Tests failed. Promotion blocked."
        exit 1
    fi
else
    log_info "No test script found (skipping)"
fi

log_section "Stage 4: Build Verification"

# Try frontend build
if [[ -d "frontend" ]]; then
    log_info "Building frontend..."
    cd frontend
    npm ci --prefer-offline 2>/dev/null || npm ci 2>/dev/null || true
    if npm run build; then
        log_success "Frontend build successful"
        cd ..
    else
        log_error "Frontend build failed"
        exit 1
    fi
fi

log_section "Stage 5: Perform Merge"

# Make sure we're on main branch before merging
if git rev-parse --abbrev-ref HEAD | grep -q "^$PROD_BRANCH$"; then
    log_error "Already on $PROD_BRANCH. Switch branches first."
    exit 1
fi

git checkout "$PROD_BRANCH"
log_info "Switched to branch: $PROD_BRANCH"

# Merge with commit message
MERGE_MESSAGE="chore: promote staging→prod ($STAGING_COMMIT)

Promoted $COMMITS_TO_PROMOTE commit(s) from $STAGING_BRANCH.
Author: $STAGING_AUTHOR
Staging commit: $STAGING_COMMIT_LONG
Date: $STAGING_DATE"

if git merge --ff-only "$STAGING_BRANCH" -m "$MERGE_MESSAGE"; then
    log_success "Successfully merged $STAGING_BRANCH into $PROD_BRANCH"
else
    log_error "Merge failed (fast-forward not possible)"
    git merge --abort 2>/dev/null || true
    exit 1
fi

log_section "Stage 6: Ready for Push"

log_info "Local branch is ready for deployment"
log_info ""
log_info "Next steps:"
log_info "1. Review the merge: git log --oneline -5"
log_info "2. Push to GitHub: git push origin $PROD_BRANCH"
log_info "3. Run deployment: ./scripts/deploy-prod.sh"
log_info ""

# Optional auto-push
read -p "Push to GitHub automatically? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if git push origin "$PROD_BRANCH"; then
        log_success "Pushed to GitHub"
        log_info ""
        log_info "Ready to deploy. Run: ./scripts/deploy-prod.sh"
    else
        log_error "Push failed"
        exit 1
    fi
fi

log_success "Staging promotion prepared successfully!"
