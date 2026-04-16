<!-- DEPLOYMENT_RUNBOOK.md -->

# 🚀 Deployment Runbook

Comprehensive guide for deploying Vitaloop to production.

## Service Level Objectives (SLOs)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Availability | 99.5% | < 99% |
| API Response Time (p95) | 500ms | > 1000ms |
| Frontend Load Time (p95) | 2s | > 5s |
| Error Rate | < 0.1% | > 1% |
| Database Connection | < 100ms | > 500ms |

## Deployment Commands

### Quick Start
```bash
# Check readiness
./scripts/pre-deploy-check.sh

# Deploy to production
./scripts/deploy-prod.sh

# With automatic backup (default)
./scripts/deploy-prod.sh

# Skip backup (careful!)
./scripts/deploy-prod.sh --no-backup

# Force deploy despite warnings
./scripts/deploy-prod.sh --force
```

## Staging → Production Workflow

### Step 1: Prepare Changes on Staging Branch
```bash
git checkout staging
git pull origin staging
# Make and commit changes
git push origin staging
```

### Step 2: Promote Staging to Main
```bash
# This verifies tests, builds, and performs merge
./scripts/promote-staging-to-prod.sh staging
```

### Step 3: Deploy to Production
```bash
# Will use the new pre-deploy checks
./scripts/deploy-prod.sh
```

## Emergency Procedures

### Show Recent Commits (No Action)
```bash
./scripts/rollback.sh
```

### Preview Rollback (No Action)
```bash
./scripts/rollback.sh abc1234
```

### Execute Rollback (Requires --confirm)
```bash
./scripts/rollback.sh abc1234 --confirm
```

## Health Checks

### Endpoints
- **Liveness**: `GET /health` (always fast)
  - Response: `{"status": "ok", "service": "vitaloop-api"}`
  - Use for: Kubernetes liveness probe
  - Threshold: HTTP 200

- **Readiness**: `GET /health/ready` (checks dependencies)
  - Response: `{"ready": true, "reason": "ready"}`
  - Use for: Kubernetes readiness probe
  - Threshold: HTTP 200, `{"ready": true}`

- **Detailed**: `GET /health/detailed` (full diagnostics)
  - Response: Detailed service status including Supabase, Stripe, email, Sentry
  - Use for: Operator dashboards
  - Threshold: Any 2xx (may return degraded status in body)

### Manual Testing
```bash
# Liveness check
curl https://api.vitaloop.today/health

# Readiness check  
curl https://api.vitaloop.today/health/ready

# Detailed diagnostics
curl https://api.vitaloop.today/health/detailed | jq
```

## Server Status Checks

### Check Services
```bash
ssh root@159.65.252.227 'systemctl status vitaloop-backend vitaloop-crm-mvc'
```

### Check Logs
```bash
# Backend logs
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -n 50 -f'

# CRM logs
ssh root@159.65.252.227 'journalctl -u vitaloop-crm-mvc -n 50 -f'
```

### Check Disk Space
```bash
ssh root@159.65.252.227 'df -h /var/www/VITALOOP'
```

### Check Git Status
```bash
ssh root@159.65.252.227 'cd /var/www/VITALOOP && git log --oneline -5 && git status'
```

## Metrics Collection

### Collect SLO Metrics
```bash
./scripts/collect-slo-metrics.sh

# Or specify custom output
./scripts/collect-slo-metrics.sh --output ./my-metrics.json

# View current metrics
cat ./monitoring/slo-metrics.json | jq
```

## Troubleshooting

### Pre-Deploy Checks Fail

**Issue**: Pre-deploy checks fail before deployment.

**Debug**:
```bash
./scripts/pre-deploy-check.sh  # Run with details
```

**Common Causes**:
1. **Git working tree dirty**: Commit or stash changes
2. **Not on main branch**: `git checkout main`
3. **Remote unreachable**: Check network access to GitHub
4. **Unpushed commits**: `git push origin main`

**Resolution**: Address the specific error message from the script.

---

### API Health Check Fails

**Issue**: `GET /health` returns error or times out.

**Debug**:
```bash
curl -v https://api.vitaloop.today/health
ssh root@159.65.252.227 'systemctl status vitaloop-backend'
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -n 100'
```

**Common Causes**:
1. **Backend not running**: `systemctl restart vitaloop-backend`
2. **Port 8004 blocked**: Check firewall/nginx
3. **Supabase unreachable**: Check SUPABASE_URL connectivity
4. **SSL cert issue**: Verify nginx SSL configuration

**Resolution**: 
```bash
# Restart backend
ssh root@159.65.252.227 'systemctl restart vitaloop-backend'

# Verify startup
sleep 3 && curl https://api.vitaloop.today/health
```

---

### Readiness Check Shows "not_ready"

**Issue**: `GET /health/ready` returns `{"ready": false}`.

**Debug**:
```bash
curl https://api.vitaloop.today/health/ready | jq

# Check individual services
curl https://api.vitaloop.today/health/detailed | jq '.services'
```

**Common Causes**:
1. **Supabase connection timeout**: Check network, SUPABASE_URL
2. **Missing environment variables**: Verify .env on server
3. **Database connection pooling exhausted**: Restart backend
4. **Load too high**: Check CPU/memory usage

**Resolution**:
```bash
# Verify environment
ssh root@159.65.252.227 'cd /var/www/VITALOOP && env | grep SUPABASE'

# Restart backend
ssh root@159.65.252.227 'systemctl restart vitaloop-backend'

# Check startup logs
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -n 50'
```

---

### Deployment Stalls During Build

**Issue**: `npm run build` or `dotnet publish` hangs or times out.

**Debug**:
```bash
# SSH into server and check processes
ssh root@159.65.252.227 'ps aux | grep -E "(npm|dotnet)"'

# Check disk space
ssh root@159.65.252.227 'df -h /var/www/VITALOOP'

# Check memory
ssh root@159.65.252.227 'free -h'
```

**Common Causes**:
1. **Low disk space**: Need >= 2GB free
2. **Out of memory**: Process killed by OOM killer
3. **npm network timeout**: npm registry temporarily unavailable
4. **Previous build locked**: Stale `node_modules/.lock` file

**Resolution**:
```bash
# Kill stuck build
ssh root@159.65.252.227 'pkill -f "npm" || true; pkill -f "dotnet" || true'

# Clean and retry
ssh root@159.65.252.227 'cd /var/www/VITALOOP/frontend && rm -rf node_modules && npm ci'

# Or revert and try again
./scripts/rollback.sh HEAD~1 --confirm
./scripts/deploy-prod.sh
```

---

### Services Don't Start After Deploy

**Issue**: `vitaloop-backend` or `vitaloop-crm-mvc` fail to start.

**Debug**:
```bash
ssh root@159.65.252.227 'systemctl status vitaloop-backend'
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -n 50 --no-pager'
```

**Common Causes**:
1. **Port already in use**: Another process bound to port
2. **Configuration invalid**: .env.production syntax error
3. **Runtime missing**: .NET not available for CRM
4. **Permission denied**: Build directory not writeable

**Resolution**:
```bash
# Find and kill process on port
ssh root@159.65.252.227 'lsof -i :8004 | grep -v COMMAND | awk "{print \$2}" | xargs kill -9 || true'

# Restart service
ssh root@159.65.252.227 'systemctl restart vitaloop-backend'

# If still failing, check .env
ssh root@159.65.252.227 'cat /var/www/VITALOOP/.env.production | head'

# Or rollback
./scripts/rollback.sh HEAD~1 --confirm
```

---

### Rollback Backup Branch Not Finding

**Issue**: Rollback script says "Target commit not found".

**Debug**:
```bash
git log --all --oneline | head -20
ssh root@159.65.252.227 'cd /var/www/VITALOOP && git log --all --oneline | head -20'
```

**Solution**:
```bash
# Find a commit you know is safe
git log --all --oneline | grep "your known commit"

# Use the short hash
./scripts/rollback.sh abc1234 --confirm
```

---

## Monitoring Setup (Optional)

### Enable Structured Logging

The backend now includes structured logging middleware that logs all HTTP requests with:
- Method, path, query parameters
- Response status code and latency
- User ID (if authenticated)
- Errors with stack traces

**View logs**:
```bash
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -o json -n 100' | jq
```

### Set Up Continuous Metrics Collection

```bash
# Add to crontab to collect metrics every 5 minutes
# (0,5,10,15... * * * * /var/www/VITALOOP/scripts/collect-slo-metrics.sh)

ssh root@159.65.252.227 '
crontab -e
# Add line: */5 * * * * cd /var/www/VITALOOP && ./scripts/collect-slo-metrics.sh
'
```

## Post-Deployment Verification Checklist

After every deployment, verify:

- [ ] `curl https://api.vitaloop.today/health` → 200 with `"status": "ok"`
- [ ] `curl https://api.vitaloop.today/health/ready` → 200 with `"ready": true`
- [ ] `curl https://vitaloop.today` → 200 with homepage loads
- [ ] `curl https://crm.vitaloop.today` → 302 redirect (expected)
- [ ] `systemctl status vitaloop-backend` → active (running)
- [ ] `systemctl status vitaloop-crm-mvc` → active (running)
- [ ] No critical errors in `journalctl -u vitaloop-backend -n 20`
- [ ] Disk usage `< 80%`: `df -h /var/www/VITALOOP`

## Build Optimization Notes

- Frontend uses Vite with manual code splitting for better load performance
- Chunks are split by vendor (React, charts, UI) and feature (Dashboard, analytics)
- Target is to keep individual chunks under 200KB gzipped
- Monitor build warnings: `npm run build 2>&1 | grep -i warning`

## Contact & Escalation

- **On-call**: Check #vitaloop-oncall Slack channel
- **Deployment issues**: Contact DevOps team
- **Data issues**: Contact database admin
- **Emergency hotline**: [add if applicable]
