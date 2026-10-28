# Phase Deployment Guide

## Overview

This guide explains how Phase deployments are automatically tracked, logged, and documented in memory.

## How It Works

### 1. **Commit Phase Work**
When you complete work for a phase, create a commit with the phase reference in the message:

```bash
git commit -m "fix(phase-1): description of changes

Detailed explanation...

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Key patterns:**
- `fix(phase-1)` — Bug fixes and corrections
- `feat(phase-2)` — New features
- `refactor(phase-3)` — Refactoring

### 2. **Push to Main**
```bash
git push origin main
```

### 3. **Automatic Deployment Pipeline**

**What happens automatically:**

```
1. Push to main
   ↓
2. GitHub Actions: CI/CD runs (tests + build)
   ↓
3. If all checks pass: Deploy to production
   ↓
4. GitHub Actions: Phase Deploy & Memory Log
   - Extracts phase info from commit message
   - Logs deployment to DEPLOYMENTS.log
   - Creates GitHub Release
   - Sends Slack notification (if configured)
   - Commits the log file back to repo
```

### 4. **Memory Documentation**

The workflow automatically:
- Reads commit message to identify phase
- Creates deployment record in memory files (in CI, would be stored in `.claude/projects/vitaloop/memory/`)
- Updates DEPLOYMENTS.log with timestamp, author, status
- Creates GitHub Release for tracking

## Deployment Checklist

Before pushing to main, ensure:

- [ ] All tests pass locally
- [ ] Code review done
- [ ] No breaking changes
- [ ] Commit message has phase identifier (phase-1, phase-2, etc.)
- [ ] Changes are well documented in commit message

## Viewing Deployments

### **DEPLOYMENTS.log**
Human-readable log of all deployments:
```bash
cat DEPLOYMENTS.log
```

### **GitHub Releases**
Each phase deployment creates a release:
```
https://github.com/softdabtech/vitaloop/releases
```

### **GitHub Actions**
Track pipeline status:
```
https://github.com/softdabtech/vitaloop/actions
```

### **Production Health**
After deployment, health check runs:
- Endpoint: `https://vitaloop.today/health`
- Status: Logged in workflow

## Phase Workflow Examples

### Phase 1: Critical Fixes
```bash
# Do work...
git add frontend/src/pages/*.jsx
git commit -m "fix(phase-1): critical dashboard UX improvements

FIXES:
- Lab Results: Add fallback for free users
- Progress: Allow basic trends for all users
- Dashboard: Add Health Score
- Dashboard: Add Next Action CTA

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

git push origin main
# Automatic: Deploy + Log + Notify
```

### Phase 2: Feature Implementation
```bash
# Do work...
git commit -m "feat(phase-2): implement advanced analytics

FEATURES:
- Build biomarker insights AI
- Add trend analysis
- Implement comparison view

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

git push origin main
# Automatic: Deploy + Log + Notify
```

## Environment Variables (GitHub Secrets)

Configure these in GitHub Settings → Secrets:

```
PROD_SSH_KEY          — SSH key for production server
PROD_HOST             — Production server hostname (159.65.252.227)
SLACK_WEBHOOK_URL     — Slack webhook for notifications
GITHUB_TOKEN          — Auto-provided by Actions
```

## Troubleshooting

### Deployment Failed
1. Check GitHub Actions logs: https://github.com/softdabtech/vitaloop/actions
2. Common issues:
   - SSH key not in secrets
   - Health check failing (API or frontend issue)
   - Database connection problem

### Memory Not Updated
- Check if commit message includes phase identifier
- Workflow only processes: `fix(phase-*)`, `feat(phase-*)`, `refactor(phase-*)`

### Slack Notification Not Sent
- Set `SLACK_WEBHOOK_URL` in GitHub secrets
- Or configure as per Actions documentation

## Manual Deployment (if needed)

If you need to deploy without using main:

```bash
# SSH to server
ssh softdab-server

# Manual deploy
cd /var/www/VITALOOP
git pull origin main
systemctl restart vitaloop-backend
cd frontend && npm run build:prod && cp -r dist/* /var/www/html/
nginx -s reload

# Health check
curl -f https://vitaloop.today/health
```

## Memory System Integration

Completed phases automatically create memory entries:

**Location:** `.claude/projects/vitaloop/memory/deployments/`

**Files created:**
- `phase_deploy_1.md` — Phase 1 deployment record
- `phase_deploy_2.md` — Phase 2 deployment record
- etc.

**In conversations:** This memory persists across sessions, so future Claude instances know:
- What was deployed when
- Who deployed it
- What changes were made
- Production status

## Phase Timeline

```
Phase 1  → Deployed → Phase 2  → Deployed → Phase 3  → Deployed → Live! 🚀
[Critical]            [Features]            [Polish]
```

After each phase deployment to main:
1. Production users get new features
2. Deployment logged in DEPLOYMENTS.log
3. GitHub Release created
4. Slack team notified
5. Memory updated for future sessions

---

**Last Updated:** 2026-05-02  
**Maintained By:** Vitaloop Development Team
