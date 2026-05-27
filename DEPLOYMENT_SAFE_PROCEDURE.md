# 🚀 Safe Deployment Procedure - Avoiding Server Memory Overload

**Problem:** Server has limited RAM (957MB total, often overloaded)  
**Solution:** Build locally, deploy only necessary files  
**Result:** Fast, reliable deployments without server strain

---

## ⚠️ DON'T DO THIS (Server will OOM)

```bash
# ❌ WRONG - Will crash the server with OOM
ssh root@server "cd /var/www/VITALOOP && npm run build"

# ❌ WRONG - Backend build also memory intensive
ssh root@server "cd /var/www/VITALOOP/backend && pip install -r requirements.txt"
```

---

## ✅ DO THIS INSTEAD (Safe, Fast)

### Step 1: Build Everything Locally

```bash
# On your local machine
cd /Users/oleksii/projects/vitaloop

# Backend: No build needed (Python)
# Just verify syntax
python3 -m py_compile backend/app/services/claude_pdf_analyzer.py
python3 -m py_compile backend/app/services/table_analyzer.py

# Frontend: Build locally
cd frontend
npm run build  # Creates dist/ folder

# Verify build was successful
ls -la dist/ | head -20
```

### Step 2: Verify Local Build

```bash
# Check all required files
test -d frontend/dist && echo "✅ Frontend built"
test -f backend/app/services/claude_pdf_analyzer.py && echo "✅ Backend code ready"
test -f backend/requirements.txt && echo "✅ Requirements ready"

# Frontend build info
cat frontend/dist/build-info.json
```

### Step 3: Deploy to Production (Memory Safe)

#### Option A: Deploy Frontend Only (Most Common)

```bash
# Build locally
cd frontend
npm run build

# Copy to server
scp -r -i ~/.ssh/softdab_new dist/* root@159.65.252.227:/var/www/VITALOOP/frontend/dist/

# Reload web server
ssh -i ~/.ssh/softdab_new root@159.65.252.227 "systemctl reload nginx"

# Verify
curl -I https://vitaloop.today/ | grep HTTP
```

#### Option B: Deploy Backend Python Code Only

```bash
# No build needed for Python
# Just upload the changed files

scp -i ~/.ssh/softdab_new \
  backend/app/services/claude_pdf_analyzer.py \
  root@159.65.252.227:/var/www/VITALOOP/backend/app/services/

scp -i ~/.ssh/softdab_new \
  backend/app/services/table_analyzer.py \
  root@159.65.252.227:/var/www/VITALOOP/backend/app/services/

scp -i ~/.ssh/softdab_new \
  backend/app/config.py \
  root@159.65.252.227:/var/www/VITALOOP/backend/app/

# Backend auto-reloads with new code
```

#### Option C: Full Deployment (Git Pull + Copy Built Files)

```bash
# 1. Build everything locally
npm run build  # Frontend only
python3 -m py_compile backend/app/services/*.py  # Verify Python

# 2. Pull on server (no build needed)
ssh -i ~/.ssh/softdab_new root@159.65.252.227 \
  "cd /var/www/VITALOOP && git pull origin main"

# 3. Deploy pre-built frontend
scp -r -i ~/.ssh/softdab_new frontend/dist/* \
  root@159.65.252.227:/var/www/VITALOOP/frontend/dist/

# 4. Reload server
ssh -i ~/.ssh/softdab_new root@159.65.252.227 "systemctl reload nginx"
```

---

## 📦 What to Deploy

### Frontend
- **Source:** `/Users/oleksii/projects/vitaloop/frontend/dist/`
- **Destination:** `/var/www/VITALOOP/frontend/dist/`
- **Method:** SCP (copy only, no build on server)
- **Files:** All files in dist/ directory

### Backend
- **Source:** `/Users/oleksii/projects/vitaloop/backend/app/`
- **Destination:** `/var/www/VITALOOP/backend/app/`
- **Method:** SCP or git pull
- **Files:** Only changed Python files (no build needed)

### Dependencies
- **Install:** Only on first deployment or when requirements.txt changes
- **Method:** `pip install -r requirements.txt` (already done)
- **Avoid:** Running on server if possible

---

## 🔍 Deployment Checklist

### Pre-Deployment (Local)
- [ ] Code committed to git
- [ ] Python files syntax checked
- [ ] Frontend built successfully
- [ ] All dist/ files present
- [ ] Tests passing locally

### Deployment
- [ ] Backend code copied to server
- [ ] Frontend dist/ copied to server
- [ ] Nginx reloaded
- [ ] Health check passing

### Post-Deployment (Verification)
- [ ] Backend responds to health check
- [ ] Frontend loads at vitaloop.today
- [ ] File upload works with all formats
- [ ] No errors in logs

---

## 📊 Deployment Comparison

| Method | Build Time | Server Load | Risk | Recommendation |
|--------|-----------|-------------|------|-----------------|
| **Local Build + SCP** | ~5-10min | Low ✅ | Low | **PREFERRED** |
| **Server npm build** | ~20-30min | HIGH ❌ | HIGH | **AVOID** |
| **Server pip install** | ~5min | Medium ⚠️ | Medium | **OK for deps** |
| **Git pull only** | ~1min | Low ✅ | Low | **Use for code** |

---

## 🛠️ Troubleshooting Deployments

### Issue: Server Running Out of Memory

**Symptom:** Build killed, process timeout, OOM error

**Solution:**
```bash
# Don't build on server!
# Build locally instead:
npm run build
scp -r dist/* root@server:/var/www/VITALOOP/frontend/dist/
```

### Issue: Frontend Not Updating

**Symptom:** Old files served after deployment

**Solution:**
```bash
# 1. Verify files copied
ssh root@server "ls -la /var/www/VITALOOP/frontend/dist/ | head -5"

# 2. Clear nginx cache
ssh root@server "rm -rf /var/cache/nginx/*"

# 3. Reload nginx
ssh root@server "systemctl reload nginx"

# 4. Hard refresh in browser: Ctrl+Shift+R
```

### Issue: Backend Not Using New Code

**Symptom:** Old behavior after code deployment

**Solution:**
```bash
# 1. Verify file copied
ssh root@server "ls -la /var/www/VITALOOP/backend/app/services/claude_pdf_analyzer.py"

# 2. Check file timestamp
ssh root@server "stat /var/www/VITALOOP/backend/app/services/claude_pdf_analyzer.py | grep Modify"

# 3. If needed, restart backend manually
ssh root@server "killall uvicorn"  # Will auto-restart

# 4. Verify it's running
ssh root@server "ps aux | grep uvicorn | grep VITALOOP"
```

### Issue: Dependencies Not Installed

**Symptom:** ImportError: No module named 'pdf2image'

**Solution:**
```bash
# Already installed on server, but if needed:
ssh root@server "cd /var/www/VITALOOP/backend && source .venv/bin/activate && pip install -r requirements.txt"
```

---

## 📝 Deployment Log Template

Create a log for each deployment:

```markdown
# Deployment: [Date/Time]

## Changes
- [ ] Frontend changes
- [ ] Backend changes
- [ ] Dependency changes
- [ ] Config changes

## Build Status
- [ ] Local build completed: npm run build
- [ ] Python syntax verified
- [ ] Build info: 234ab490 (commit)

## Deployment
- [ ] Files copied to server
- [ ] Nginx reloaded
- [ ] Backend checked
- [ ] Health checks passing

## Verification
- [ ] Frontend loads: https://vitaloop.today/
- [ ] File upload works
- [ ] No errors in logs
- [ ] Performance acceptable

## Issues
- None

## Sign-Off
- Deployed by: [name]
- Approved by: [name]
- Date: [date]
```

---

## 🚀 Quick Deploy Script

Create this script locally for fast deployments:

```bash
#!/bin/bash
# deploy.sh - Safe deployment to production

set -e

REMOTE_USER="root"
REMOTE_HOST="159.65.252.227"
SSH_KEY="$HOME/.ssh/softdab_new"
PROJECT_PATH="/var/www/VITALOOP"

echo "🚀 Starting safe deployment..."

# 1. Build locally
echo "📦 Building frontend locally..."
cd frontend
npm run build
cd ..

echo "✅ Local build complete"

# 2. Deploy frontend
echo "📤 Deploying frontend to server..."
scp -r -i "$SSH_KEY" frontend/dist/* \
  "$REMOTE_USER@$REMOTE_HOST:$PROJECT_PATH/frontend/dist/"

# 3. Pull latest code
echo "📥 Pulling latest code on server..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" \
  "cd $PROJECT_PATH && git pull origin main"

# 4. Reload web server
echo "🔄 Reloading nginx..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" \
  "systemctl reload nginx"

# 5. Verify
echo "✅ Verifying deployment..."
curl -s -I https://vitaloop.today/ | head -5

echo "🎉 Deployment complete!"
```

Usage:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🔐 Security Notes

### File Permissions
```bash
# After deployment, verify permissions
ssh root@server "ls -la /var/www/VITALOOP/frontend/dist/*.html | head -3"
# Should show: -rw-r--r-- (644) or similar
```

### No Secrets in Deployment
- Never commit `.env` files
- Never commit private keys
- Use SSH keys for authentication (not passwords)
- Secrets stored on server only

---

## 📊 Server Resources Monitoring

### Before Deployment
```bash
ssh root@server "free -h"
# Should show: > 500MB available
```

### During Deployment
```bash
# Monitor in separate window
ssh root@server "watch -n 1 'free -h && echo --- && ps aux --sort=-%mem | head -5'"
```

### After Deployment
```bash
ssh root@server "free -h"
# Should be back to normal
```

---

## ✅ Deployment Best Practices

1. **Always Build Locally**
   - Use your machine's resources
   - Faster builds (more RAM available)
   - Safer (no server downtime)

2. **Deploy Only What Changed**
   - Don't re-deploy everything
   - Just copy changed dist/ or Python files
   - Use git pull for code updates

3. **Verify Before Deployment**
   - Test locally with: `npm run dev`
   - Check syntax: `python3 -m py_compile`
   - Run tests: `npm run test` or `pytest`

4. **Monitor During Deployment**
   - Watch server resources
   - Check health after each step
   - Verify in multiple browsers

5. **Have a Rollback Plan**
   - Keep backup of previous dist/
   - Know how to revert git commits
   - Document changes made

---

## 🎓 When to Rebuild

### Do Rebuild When:
- ✅ Frontend code changes (always)
- ✅ Adding new dependencies
- ✅ Updating build configuration

### Don't Rebuild When:
- ❌ Only Python backend code changes (no build needed)
- ❌ Only config changes (no build needed)
- ❌ Only documentation changes (no build needed)

---

## 📞 Questions?

For deployment issues:
1. Check if server has free memory: `free -h`
2. Check logs: `tail -f /var/log/nginx/error.log`
3. Check health: `curl http://159.65.252.227:8004/health`
4. Review this guide for your specific scenario

---

**Status:** Ready for safe, efficient deployments 🚀  
**Last Updated:** May 27, 2026  
**Memory Safe:** ✅ Yes - No server builds
