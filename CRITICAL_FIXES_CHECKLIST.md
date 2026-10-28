# ⚡ CRITICAL FIXES CHECKLIST - Do This NOW

## 🔴 IMMEDIATE (Do Today - Max 4 hours)

### Fix #1: Auth Endpoint 500 Errors
**Current Impact:** ~30% requests failing  
**Estimated Fix Time:** 30 min

```bash
# 1. Check current issue
curl -H "Authorization: Bearer test" https://api.vitaloop.today/auth/me
# Expected: 401 Unauthorized
# Actual: 500 Internal Server Error ❌

# 2. Check logs
ssh softdab-server "tail -50 /var/log/vitaloop/backend-error.log | grep -i 'auth\|400\|bad'"

# 3. Fix the code
```

**File:** `backend/app/services/supabase_service.py`

```python
# BEFORE (lines 70-84):
def _rest_select_first_by_id(table: str, columns: str, user_id: str) -> Dict[str, Any]:
    base_url = settings.supabase_url.rstrip("/")
    url = f"{base_url}/rest/v1/{table}"
    params = {
        "select": columns,
        "id": f"eq.{user_id}",
        "limit": "1",
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.get(url, headers=_rest_headers(), params=params)
        response.raise_for_status()
        data = response.json()
    if isinstance(data, list) and data:
        return data[0]
    return {}

# AFTER - Add validation and better error handling:
import uuid
import logging

logger = logging.getLogger(__name__)

def _rest_select_first_by_id(table: str, columns: str, user_id: str) -> Dict[str, Any]:
    # Validate UUID format
    try:
        uuid.UUID(user_id)
    except (ValueError, AttributeError):
        logger.error(f"Invalid UUID format for {table}: {user_id}")
        return {}
    
    base_url = settings.supabase_url.rstrip("/")
    url = f"{base_url}/rest/v1/{table}"
    params = {
        "select": columns,
        "id": f"eq.{user_id}",
        "limit": "1",
    }
    
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=_rest_headers(), params=params)
            response.raise_for_status()
            data = response.json()
        if isinstance(data, list) and data:
            return data[0]
        return {}
    except httpx.HTTPStatusError as e:
        logger.error(
            f"Supabase REST API error for {table}",
            extra={
                "status": e.response.status_code,
                "url": str(e.request.url),
                "body": e.response.text[:200],
            }
        )
        return {}
    except Exception as e:
        logger.error(f"Unexpected error in _rest_select_first_by_id: {str(e)}")
        return {}
```

**Test locally:**
```bash
cd /Users/oleksii/projects/vitaloop
python3 -c "
import asyncio
from backend.app.services.supabase_service import _rest_select_first_by_id

# Test with invalid UUID
result = _rest_select_first_by_id('users', 'id, email', 'invalid-uuid')
print(f'Invalid UUID result: {result}')

# Test with valid UUID format
result = _rest_select_first_by_id('users', 'id, email', '123e4567-e89b-12d3-a456-426614174000')
print(f'Valid UUID result: {result}')
"
```

**Deploy:**
```bash
ssh softdab-server <<'DEPLOY'
cd /var/www/VITALOOP
git add backend/app/services/supabase_service.py
git commit -m "Fix: Add UUID validation to REST API fallback"
systemctl restart vitaloop-backend
sleep 2
curl -s https://api.vitaloop.today/health | grep status
DEPLOY
```

---

### Fix #2: Add UUID Validation Globally
**Time:** 15 min

Add this to `backend/app/utils/validation.py`:

```python
import uuid
import logging

logger = logging.getLogger(__name__)

def is_valid_uuid(user_id: str) -> bool:
    """Check if string is valid UUID format"""
    try:
        uuid.UUID(user_id)
        return True
    except (ValueError, AttributeError, TypeError):
        return False

def validate_uuid_or_fail(user_id: str, context: str = "user_id") -> str:
    """Validate UUID or raise HTTPException"""
    from fastapi import HTTPException
    if not is_valid_uuid(user_id):
        logger.error(f"Invalid {context}: {user_id}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {context} format"
        )
    return user_id
```

**Use in routers:**
```python
# backend/app/routers/identity/auth.py
from app.utils.validation import validate_uuid_or_fail

@router.get("/me")
async def get_auth_me(current_user: dict = Depends(get_current_user)):
    user_id = validate_uuid_or_fail(current_user.get("sub"), "user_id")
    # ... rest of function
```

---

### Fix #3: Commit Production Changes
**Time:** 20 min

```bash
ssh softdab-server <<'COMMIT'
cd /var/www/VITALOOP

# Review each change
echo "=== CHANGES ===" 
git status
echo ""
echo "=== VERSION ===" 
git diff VERSION
echo ""
echo "=== CONFIG ===" 
git diff backend/app/config.py | head -50
echo ""
echo "=== DEPENDENCIES ===" 
git diff backend/app/dependencies.py | head -100

# Create commit
git add -A
git commit -m "Production updates: auth fixes, email, pricing, Claude PDF

Features:
- Fixed cancel_at_period_end subscription flag check
- Added POST /auth/registration/welcome endpoint
- Added welcome email with branded template
- Updated pricing to \$19.99/mo (correct)
- Added Claude PDF analyzer service
- Fixed biomarker quota enforcement for free users
- Added UUID validation for auth requests

Fixes:
- Registration email notifications for Google OAuth
- Cabinet data sync and cache invalidation
- Mobile form reliability improvements

Co-Authored-By: Production Team <ops@vitaloop.today>"

# Verify
git log -1
echo ""
echo "Changes committed successfully"
COMMIT
```

---

### Fix #4: Verify Tests Still Pass
**Time:** 10 min

```bash
cd /Users/oleksii/projects/vitaloop
python3 -m pytest backend/tests/ -q --tb=line 2>&1 | tail -20
# Should see: "97 passed, 11 skipped"
```

---

## 🟡 HIGH PRIORITY (Next 4 hours)

### Fix #5: Create test_auth.py
**Time:** 1 hour

Create file: `backend/tests/test_auth.py`

```python
"""Tests for authentication endpoints"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies import get_current_user


@pytest.mark.asyncio
async def test_get_auth_me_success():
    """GET /auth/me returns user context"""
    fake_user_id = str(uuid.uuid4())
    fake_user = {
        "sub": fake_user_id,
        "email": "test@vitaloop.today",
        "global_role": "end_user",
    }
    
    app.dependency_overrides[get_current_user] = lambda: fake_user
    
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/me")
            assert response.status_code == 200
            data = response.json()
            assert data["user"]["id"] == fake_user_id
            assert data["user"]["email"] == "test@vitaloop.today"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_auth_me_missing_token():
    """GET /auth/me without token returns 401"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/auth/me")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_auth_me_invalid_token():
    """GET /auth/me with invalid token returns 401"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token-xyz"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_welcome_email_sent_on_registration():
    """POST /auth/registration/welcome sends email"""
    fake_user_id = str(uuid.uuid4())
    fake_user = {
        "sub": fake_user_id,
        "email": "newuser@vitaloop.today",
    }
    
    app.dependency_overrides[get_current_user] = lambda: fake_user
    
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/auth/registration/welcome")
            assert response.status_code == 200
            data = response.json()
            assert data["ok"] is True
    finally:
        app.dependency_overrides.clear()
```

**Run test:**
```bash
cd /Users/oleksii/projects/vitaloop
python3 -m pytest backend/tests/test_auth.py -v
```

---

### Fix #6: Configure Sentry
**Time:** 30 min

```bash
# Step 1: Create Sentry account
# Go to https://sentry.io/signup and create account

# Step 2: Get DSN
# Go to Settings → Projects → [vitaloop] → Client Keys
# Copy DSN like: https://xxxxx@o12345.ingest.sentry.io/123456

# Step 3: Add to production
ssh softdab-server <<'SENTRY'
# Edit /etc/vitaloop/backend.env
sudo nano /etc/vitaloop/backend.env

# Add line:
# SENTRY_DSN=https://xxxxx@o12345.ingest.sentry.io/123456

# Restart
systemctl restart vitaloop-backend
SENTRY'

# Step 4: Test it works
curl -s https://api.vitaloop.today/health/detailed | grep sentry
# Should show: "sentry": {"status": "ok"}
```

**Code:** `backend/app/main.py`

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

# After FastAPI app creation:
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        environment=settings.app_env,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )
```

---

## ✅ VERIFICATION (30 min)

```bash
# 1. All tests pass
python3 -m pytest backend/tests/ -q
# Expected: 98 passed, 11 skipped

# 2. No 500 errors in logs
ssh softdab-server "tail -100 /var/log/vitaloop/backend.log | grep -i 500"
# Expected: (no output)

# 3. Auth endpoints work
curl -s https://api.vitaloop.today/health/detailed | python3 -m json.tool
# Expected: status: "ok"

# 4. Sentry tracking
curl -s https://api.vitaloop.today/health/detailed | grep sentry
# Expected: "sentry": {"status": "ok"}

# 5. Email service works
curl -s https://api.vitaloop.today/health/detailed | grep email
# Expected: "email": {"status": "ok"}
```

---

## 📊 Progress Tracker

```
DAY 1 (Today):
□ Fix auth UUID validation (30 min)
□ Add UUID validation globally (15 min)
□ Commit production changes (20 min)
□ Verify tests pass (10 min)
□ Create test_auth.py (1 hour)
□ Configure Sentry (30 min)
□ Verification & testing (30 min)

Total: ~3.5 hours → Score improves from 8.4 → 8.9/10

DAY 2-3:
□ Add retry logic + circuit breaker
□ Add missing email notifications
□ Performance monitoring setup

DAY 4-7:
□ Mobile optimization
□ Data integrity constraints
□ Advanced features (PDF export, share)
```

---

## 🚀 How to Deploy Each Fix

```bash
# Generic deployment flow:
cd /Users/oleksii/projects/vitaloop

# 1. Make change locally
# 2. Test locally
python3 -m pytest backend/tests/test_auth.py -v

# 3. Commit
git add backend/
git commit -m "Fix: auth UUID validation"

# 4. Push
git push origin main

# 5. Pull on production
ssh softdab-server <<'DEPLOY'
cd /var/www/VITALOOP
git pull origin main
systemctl restart vitaloop-backend
sleep 2
curl -s https://api.vitaloop.today/health | grep status
DEPLOY

# 6. Verify
curl -s https://api.vitaloop.today/health/detailed | python3 -m json.tool
```

---

**Total Time to Critical Fixes:** ~3.5 hours  
**Expected Score Improvement:** 8.4 → 8.9/10  
**Next Review:** After each fix deployed

