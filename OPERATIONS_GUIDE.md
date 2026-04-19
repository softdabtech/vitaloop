# 🛠️ Production Operations Manual

## Deployment Status: ✅ LIVE

**Last Deployment:** April 19, 2026 10:56 UTC  
**Version:** v3.2.1  
**Commit:** b402f0b4ead4bbeef86ea6a39780a2bd6a599b25  
**Status:** ✅ All services operational  

---

## 🏗️ Infrastructure Overview

### Server Details
- **Host:** 159.65.252.227
- **User:** root
- **SSH Key:** ~/.ssh/id_rsa
- **OS:** Debian Linux
- **Disk:** 337GB available

### Services
1. **Backend API** (vitaloop-backend)
   - Type: Python FastAPI
   - Port: Internal (proxied via nginx)
   - Process: systemd service
   - Command: `uvicorn app.main:app`

2. **Frontend** (nginx reverse proxy)
   - Port: 80 (HTTP) → HTTPS via Let's Encrypt
   - Serves: React SPA
   - Path: /var/www/VITALOOP/frontend/dist

3. **CRM Dashboard** (.NET)
   - Type: ASP.NET Core
   - Port: Internal
   - Status: Running independently

---

## 📂 Directory Structure on Server

```
/var/www/VITALOOP/
├── backend/                 # Python FastAPI
│   ├── app/
│   ├── scripts/
│   ├── sql/
│   └── requirements.txt
├── frontend/               # React SPA
│   ├── dist/              # Built files (served by nginx)
│   └── ...
├── crm-mvc/               # .NET CRM
├── .git/                  # Git repository
└── .env                   # Symlink to /etc/vitaloop/backend.env
```

### Environment Files
- **Backend:** `/etc/vitaloop/backend.env` (main source)
- **Symlink:** `/var/www/VITALOOP/backend/.env` → points to above

---

## 🔄 Common Operations

### Check Service Status

```bash
# Check backend service
ssh root@159.65.252.227 "systemctl status vitaloop-backend"

# Check if backend is listening
ssh root@159.65.252.227 "curl http://localhost:8000/health"

# Check frontend (nginx)
ssh root@159.65.252.227 "systemctl status nginx"

# Check all services
ssh root@159.65.252.227 "systemctl status vitaloop-* nginx"
```

### View Logs

```bash
# Backend logs (last 50 lines)
ssh root@159.65.252.227 "journalctl -u vitaloop-backend -n 50 --no-pager"

# Follow backend logs in real-time
ssh root@159.65.252.227 "journalctl -u vitaloop-backend -f"

# Nginx error log
ssh root@159.65.252.227 "tail -50 /var/log/nginx/error.log"
```

### Restart Services

```bash
# Restart backend
ssh root@159.65.252.227 "systemctl restart vitaloop-backend"

# Restart nginx
ssh root@159.65.252.227 "systemctl restart nginx"

# Restart all services
ssh root@159.65.252.227 "systemctl restart vitaloop-backend nginx"
```

---

## 🚀 Deployment Process

### Manual Deployment Steps

```bash
# 1. SSH to server
ssh -i ~/.ssh/id_rsa root@159.65.252.227

# 2. Navigate to app directory
cd /var/www/VITALOOP

# 3. Check git status
git status

# 4. Pull latest code
git pull origin main

# 5. Check if backend requirements changed
git diff HEAD~1 backend/requirements.txt

# 6. Install dependencies if needed
pip install -r backend/requirements.txt

# 7. Restart service
systemctl restart vitaloop-backend

# 8. Verify it's running
curl http://localhost:8000/health
```

### Automated Deployment (Local)

```bash
cd ~/projects/vitaloop
export REMOTE_HOST="root@159.65.252.227"
export REMOTE_DIR="/var/www/VITALOOP"
export SSH_OPTS="-i ~/.ssh/id_rsa"
bash scripts/deploy-prod.sh
```

---

## ✅ Health Check Endpoints

### API Health Checks

```bash
# Basic health
curl https://api.vitaloop.today/health

# Readiness check (includes DB)
curl https://api.vitaloop.today/ready

# Admin runtime status
curl https://api.vitaloop.today/admin/runtime-readiness
```

**Expected Response (health):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-19T10:56:22Z",
  "version": "3.2.1"
}
```

---

## 🔄 Rollback Procedure

### If Issues Found

```bash
# 1. Check backup branch
git branch | grep backup

# 2. Switch to backup
cd /var/www/VITALOOP
git checkout backup-prod-20260419-105622

# 3. Restart service
systemctl restart vitaloop-backend

# 4. Verify health
curl http://localhost:8000/health

# 5. Investigate issue
git log --oneline main..backup-prod-20260419-105622
```

### Full Rollback Script

```bash
#!/bin/bash
BACKUP="backup-prod-20260419-105622"
cd /var/www/VITALOOP
git checkout $BACKUP
systemctl restart vitaloop-backend
curl http://localhost:8000/health
echo "Rollback complete"
```

---

## 📊 Monitoring

### Key Metrics to Monitor

1. **CPU Usage**
   - Backend process: Should be < 20% at idle
   - Spike: Check for slow queries or high load

2. **Memory Usage**
   - Backend: Typically 200-400MB
   - Warning: > 800MB indicates memory leak

3. **Response Time**
   - Health endpoint: < 100ms
   - API endpoints: < 1s
   - File uploads: < 5s

4. **Error Rate**
   - Target: < 0.1% (1 error per 1000 requests)
   - Monitor 5xx errors in logs

5. **Database Connections**
   - Max pool: 20 connections
   - Check for connection exhaustion

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response Time | > 2s | > 5s |
| Error Rate | > 0.5% | > 2% |
| Memory | > 600MB | > 900MB |
| Disk | > 80% | > 95% |
| CPU | > 50% | > 80% |

---

## 🔐 Security Checks

### SSL/TLS Certificate

```bash
# Check certificate expiry
echo | openssl s_client -servername api.vitaloop.today -connect api.vitaloop.today:443 2>/dev/null | openssl x509 -noout -dates

# Expected: "notAfter" date in future
```

### Security Headers

```bash
# Check headers are present
curl -I https://api.vitaloop.today/health

# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

### Rate Limiting

```bash
# Test rate limit (should work initially)
curl https://api.vitaloop.today/analyze -X POST

# After 12 requests per minute, should get 429
```

---

## 🐛 Troubleshooting

### Backend Service Won't Start

```bash
# Check logs for errors
journalctl -u vitaloop-backend -n 100 --no-pager

# Common issues:
# - Port already in use: check who's listening on 8000
ss -tlnp | grep 8000

# - Missing dependencies: reinstall
pip install -r backend/requirements.txt

# - Database connection: check .env file
cat /etc/vitaloop/backend.env | grep DATABASE

# - Permission issues: check ownership
ls -la /var/www/VITALOOP
```

### Slow API Responses

```bash
# Check backend memory
ps aux | grep uvicorn

# Check database performance
# Log into Supabase dashboard to check query performance

# Check nginx logs for slow requests
tail -100 /var/log/nginx/access.log | grep -E "HTTP.*[45][0-9][0-9]"
```

### High Error Rate

```bash
# Check error logs
journalctl -u vitaloop-backend -p err --no-pager

# Count error patterns
journalctl -u vitaloop-backend | grep ERROR | cut -d: -f2- | sort | uniq -c | sort -rn

# Common errors:
# - Connection timeouts: Database issue
# - JWT errors: Auth configuration
# - 422 errors: Input validation
```

---

## 📋 Maintenance Checklist

### Daily
- [ ] Check service status (health endpoints)
- [ ] Monitor error logs
- [ ] Verify disk space

### Weekly
- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Validate backup integrity

### Monthly
- [ ] Full system health audit
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Certificate expiry check
- [ ] Performance baseline update

---

## 🔑 Credentials & Access

### SSH Access
```
Host: 159.65.252.227
User: root
Key: ~/.ssh/id_rsa
```

### Database Access
- **Type:** Supabase PostgreSQL
- **Access:** Backend auth via JWT
- **Admin:** Supabase dashboard

### Monitoring
- **Logs:** systemd journalctl
- **Errors:** Application logs
- **Performance:** CLI tools (curl, ps, ss)

---

## 📞 Escalation Procedure

### P1 - Critical (Service Down)
1. Check service status: `systemctl status vitaloop-backend`
2. Check health endpoint: `curl http://localhost:8000/health`
3. Review logs: `journalctl -u vitaloop-backend -n 50 --no-pager`
4. Attempt restart: `systemctl restart vitaloop-backend`
5. If still down, rollback to backup branch
6. Notify team immediately

### P2 - High (Degraded Performance)
1. Identify slow endpoint from logs
2. Check resource usage (CPU, memory, disk)
3. Analyze database performance
4. Restart service if memory high
5. Schedule investigation

### P3 - Medium (Minor Issues)
1. Document issue
2. Monitor for recurrence
3. Fix in next deployment
4. Schedule for next release

---

## 📊 Deployment History

| Date | Commit | Version | Status |
|------|--------|---------|--------|
| 2026-04-19 | b402f0b | v3.2.1 | ✅ Live |
| Backup | backup-prod-20260419-105622 | v3.2.1 | Available |

---

## 🎯 Key Contacts

For deployment issues:
- Engineer on call (check Slack channel #on-call)
- DevOps team: Check escalation procedure

For feature questions:
- Product team
- Backend team lead

---

**Last Updated:** April 19, 2026 10:56 UTC  
**Status:** ✅ All systems operational  
**Next Review:** April 26, 2026
