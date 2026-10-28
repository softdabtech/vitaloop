# Phase Work QuickStart

## 🚀 For Each Phase: 3 Steps

### Step 1: Do the work
```bash
# Edit files, commit as usual
git commit -m "fix(phase-N): description

Details...

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Step 2: Push to main
```bash
git push origin main
```

### Step 3: Automatic! ✨
```
✅ Tests run
✅ Build succeeds  
✅ Deploy to production
✅ Health check passes
✅ Deployment logged
✅ GitHub Release created
✅ Slack notification sent
✅ Memory updated
```

---

## 📋 Phase Naming Convention

Use in commit messages:

| Pattern | Use Case | Example |
|---------|----------|---------|
| `fix(phase-1)` | Bug fixes, corrections | "Fix Lab Results 402 error" |
| `feat(phase-2)` | New features, additions | "Add biomarker insights" |
| `refactor(phase-3)` | Code improvements | "Optimize dashboard performance" |

---

## 📊 Viewing Results

| What | Where |
|------|-------|
| **Deployment log** | `DEPLOYMENTS.log` (auto-updated) |
| **Production status** | https://vitaloop.today |
| **Release history** | GitHub Releases |
| **Pipeline logs** | GitHub Actions tab |
| **Phase memory** | `.claude/projects/vitaloop/memory/deployments/` |

---

## ⚡ Phase Status Tracker

```
Phase 1: ✅ DEPLOYED (Lab Results, Progress, Dashboard fixes)
Phase 2: ⏳ IN PROGRESS
Phase 3: ⏳ PLANNED

Total phases: 3
Completed: 1/3 (33%)
```

---

## 🔧 If Something Breaks

1. **Deployment failed?**
   - Check: https://github.com/softdabtech/vitaloop/actions
   - Common: SSH key, health check, DB connection

2. **Need to rollback?**
   - Revert commit: `git revert <commit-sha>`
   - Push to main: automatic redeploy
   - Status in Actions tab

3. **Memory didn't update?**
   - Commit message must have `phase-N` pattern
   - Check DEPLOYMENTS.log was created

---

## 📚 Full Guide

See `PHASE_DEPLOYMENT_GUIDE.md` for detailed setup and troubleshooting.

---

**Remember:** 
- Always commit phase work with phase identifier
- Push only when ready (triggers automatic deploy)
- Check Actions tab to confirm success
- All deployments logged automatically
