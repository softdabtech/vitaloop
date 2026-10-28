# EXECUTION SPEC #2: BACKEND ENDPOINTS

**Framework:** FastAPI  
**Database:** Supabase PostgreSQL  
**Auth:** Supabase Auth (JWT)

---

## EXISTING ENDPOINTS TO REUSE

```
POST   /api/uploads                    ✅ Already works
GET    /api/uploads/:id                ✅ Already works
GET    /api/biomarkers/:upload_id      ✅ Already works
POST   /api/stripe/subscribe           ✅ Already works
GET    /api/user/profile               ✅ Already works
```

Do NOT modify these. Use them as-is.

---

## NEW ENDPOINTS TO ADD

### 1. GENERATE REPORT (Immediate Report)

**Endpoint:** `POST /api/uploads/:upload_id/generate-report`

**Purpose:** Generate immediate report with priority markers + protocol (called after upload completes)

**Authentication:** Required (Bearer JWT)

**Request:**
```json
{
  "upload_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (201):**
```json
{
  "id": "report-123",
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "generated_at": "2026-06-05T14:30:00Z",
  
  "priority_markers": [
    {
      "marker_name": "ferritin",
      "marker_value": 12,
      "marker_unit": "μg/L",
      "status": "critical",
      "lab_reference_min": 30,
      "lab_reference_max": 150,
      "lab_name": "Quest Diagnostics",
      "explanation": "Ferritin measures iron storage in your body. Your level is critically low.",
      "potential_causes": ["fatigue", "weak_immune_system", "hair_loss"],
      "recommended_action": "Discuss iron supplementation with your doctor. Common options: iron supplement (25-50mg elemental iron daily) or increasing iron-rich foods.",
      "retest_days_min": 28,
      "retest_days_max": 56
    },
    {
      "marker_name": "vitamin_d",
      "marker_value": 18,
      "marker_unit": "ng/mL",
      "status": "low",
      "lab_reference_min": 30,
      "lab_reference_max": 100,
      "explanation": "Vitamin D supports bone health, immunity, and mood. Your level is below optimal.",
      "potential_causes": ["mood_issues", "weak_bones", "immune_challenges"],
      "recommended_action": "Increase sun exposure and consider vitamin D3 supplementation (1000-2000 IU daily).",
      "retest_days_min": 56,
      "retest_days_max": 84
    }
  ],
  
  "full_results": [
    // All biomarkers, not just priority
  ],
  
  "protocol": {
    "ferritin": {
      "marker_name": "ferritin",
      "marker_value": 12,
      "status": "critical",
      "actions": [
        {
          "action_type": "lifestyle",
          "description": "Eat iron-rich foods 2-3 times per week",
          "details": "Red meat, spinach, beans, lentils, fortified cereals",
          "priority": 1,
          "duration_days": 56
        },
        {
          "action_type": "lifestyle",
          "description": "Consume vitamin C with iron meals",
          "details": "Orange juice, citrus, tomato sauce helps iron absorption",
          "priority": 1,
          "duration_days": 56
        },
        {
          "action_type": "supplement",
          "description": "Consider iron supplementation",
          "details": "Discuss with doctor: 25-50mg elemental iron daily. Take with vitamin C, separate from tea/coffee.",
          "priority": 1,
          "duration_days": 56,
          "requires_doctor_discussion": true
        }
      ]
    },
    "vitamin_d": {
      "marker_name": "vitamin_d",
      "actions": [
        // Similar structure
      ]
    }
  },
  
  "next_steps": {
    "primary": "Start daily check-in to track progress",
    "secondary": "Schedule retest in 8 weeks"
  }
}
```

**Implementation:**
```python
# app/routers/reports.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.services.report_generator import ReportGenerator

router = APIRouter(prefix="/api", tags=["reports"])

@router.post("/uploads/{upload_id}/generate-report")
async def generate_report(
    upload_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate immediate report with priority markers and protocol"""
    
    # Verify ownership
    upload = db.query(Upload).filter(
        Upload.id == upload_id,
        Upload.user_id == current_user.id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Get biomarkers from existing table
    biomarkers = db.query(Biomarker).filter(
        Biomarker.upload_id == upload_id
    ).all()
    
    # Generate report using rules engine
    generator = ReportGenerator()
    report = generator.generate_report(biomarkers, upload)
    
    return report
```

---

### 2. GET REPORT

**Endpoint:** `GET /api/reports/:upload_id`

**Response (200):**
```json
{
  "id": "report-123",
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "priority_markers": [...],
  "full_results": [...],
  "protocol": {...},
  "viewed_at": "2026-06-05T14:45:00Z"
}
```

**Implementation:**
```python
@router.get("/reports/{upload_id}")
async def get_report(
    upload_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cached report for upload"""
    
    report = db.query(Report).filter(
        Report.upload_id == upload_id,
        Report.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404)
    
    # Track analytics
    track_event("report_viewed", {
        "upload_id": upload_id,
        "user_id": current_user.id
    })
    
    return report
```

---

### 3. CREATE CHECK-IN

**Endpoint:** `POST /api/check-ins`

**Request:**
```json
{
  "date": "2026-06-05",
  "mood": "better",
  "fatigue_level": 5,
  "sleep_hours": 7,
  "energy_level": 6
}
```

**Response (201):**
```json
{
  "id": "checkin-123",
  "date": "2026-06-05",
  "mood": "better",
  "fatigue_level": 5,
  "sleep_hours": 7,
  "energy_level": 6,
  "created_at": "2026-06-05T18:30:00Z",
  
  "pattern": {
    "exists": true,
    "description": "You've been feeling better since starting supplementation",
    "days_tracked": 7,
    "trend": "improving"
  },
  
  "free_checkins_remaining": 2  // If on free tier
}
```

**Implementation:**
```python
@router.post("/check-ins")
async def create_checkin(
    data: CheckInData,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create daily check-in"""
    
    # Verify free tier limits (3 free check-ins per upload, then paywall)
    if not current_user.is_premium:
        checkin_count = db.query(CheckIn).filter(
            CheckIn.user_id == current_user.id
        ).count()
        
        if checkin_count >= 3:
            raise HTTPException(
                status_code=402,  # Payment required
                detail="Free tier limited to 3 check-ins. Upgrade to Premium.",
                headers={"X-Paywall-Reason": "free_tier_limit"}
            )
    
    # Create check-in
    checkin = CheckIn(
        user_id=current_user.id,
        date=data.date,
        mood=data.mood,
        fatigue_level=data.fatigue_level,
        sleep_hours=data.sleep_hours,
        energy_level=data.energy_level
    )
    
    db.add(checkin)
    db.commit()
    
    # Analyze pattern if user has 7+ check-ins
    pattern = None
    all_checkins = db.query(CheckIn).filter(
        CheckIn.user_id == current_user.id
    ).order_by(CheckIn.date.desc()).limit(30).all()
    
    if len(all_checkins) >= 7:
        pattern = analyze_checkin_pattern(all_checkins)
    
    # Track analytics
    track_event("checkin_completed", {
        "mood": data.mood,
        "has_details": data.fatigue_level is not None
    })
    
    return {
        "id": checkin.id,
        "date": checkin.date,
        "mood": checkin.mood,
        "pattern": pattern,
        "free_checkins_remaining": max(0, 3 - (checkin_count + 1)) if not current_user.is_premium else None
    }
```

---

### 4. GET CHECK-IN HISTORY

**Endpoint:** `GET /api/check-ins/history?days=30`

**Response (200):**
```json
{
  "checkins": [
    {
      "date": "2026-06-05",
      "mood": "better",
      "fatigue_level": 5,
      "sleep_hours": 7,
      "energy_level": 6
    }
  ],
  "summary": {
    "total_checkins": 12,
    "mood_trend": "improving",
    "avg_sleep_hours": 6.8,
    "avg_energy": 5.9,
    "avg_fatigue": 5.2
  },
  "is_premium": true  // Show history only for premium
}
```

**Implementation:**
```python
@router.get("/check-ins/history")
async def get_checkin_history(
    days: int = 30,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get check-in history (premium users only)"""
    
    if not current_user.is_premium:
        raise HTTPException(
            status_code=403,
            detail="Premium feature. Upgrade to see history."
        )
    
    start_date = date.today() - timedelta(days=days)
    
    checkins = db.query(CheckIn).filter(
        CheckIn.user_id == current_user.id,
        CheckIn.date >= start_date,
        CheckIn.deleted_at.is_(None)
    ).order_by(CheckIn.date.desc()).all()
    
    return {
        "checkins": checkins,
        "summary": calculate_summary(checkins)
    }
```

---

### 5. GET INSIGHTS

**Endpoint:** `GET /api/insights?upload_id=:upload_id`

**Response (200):**
```json
{
  "insights": [
    {
      "id": "insight-123",
      "marker_name": "ferritin",
      "status": "critical",
      "explanation": "Your ferritin is critically low...",
      "recommended_action": "Discuss iron supplementation...",
      "read_at": null,
      "created_at": "2026-06-05T14:30:00Z"
    }
  ],
  "unread_count": 3
}
```

**Implementation:**
```python
@router.get("/insights")
async def get_insights(
    upload_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get insights for upload"""
    
    insights = db.query(Insight).filter(
        Insight.user_id == current_user.id,
        Insight.upload_id == upload_id,
        Insight.deleted_at.is_(None)
    ).all()
    
    # Track viewing
    for insight in insights:
        if not insight.read_at:
            insight.read_at = datetime.now()
    
    db.commit()
    
    return {
        "insights": insights,
        "unread_count": len([i for i in insights if i.read_at is None])
    }
```

---

### 6. GET PROTOCOL

**Endpoint:** `GET /api/protocols?upload_id=:upload_id`

**Response (200):**
```json
{
  "protocols": [
    {
      "id": "protocol-123",
      "marker_name": "ferritin",
      "marker_status": "critical",
      "actions": [
        {
          "id": "action-1",
          "action_type": "lifestyle",
          "description": "Eat iron-rich foods 2-3 times per week",
          "details": "Red meat, spinach, beans...",
          "priority": 1,
          "duration_days": 56,
          "completed_at": null
        }
      ]
    }
  ],
  "completion_rate": 0.45
}
```

---

### 7. GET RETEST RECOMMENDATIONS

**Endpoint:** `GET /api/retest-recommendations?upload_id=:upload_id`

**Response (200):**
```json
{
  "recommendations": [
    {
      "id": "retest-123",
      "marker_name": "ferritin",
      "recommended_date": "2026-07-31",
      "reason": "Low ferritin needs monitoring after supplementation",
      "scheduled_at": null,
      "completed_at": null
    }
  ],
  "next_retest_date": "2026-07-31"
}
```

---

### 8. MARK INSIGHT AS READ

**Endpoint:** `PATCH /api/insights/:insight_id`

**Request:**
```json
{
  "read_at": "2026-06-05T14:45:00Z"
}
```

**Response (200):** Updated insight object

---

### 9. MARK PROTOCOL ACTION AS COMPLETED

**Endpoint:** `PATCH /api/protocols/:protocol_id`

**Request:**
```json
{
  "completed_at": "2026-06-05T14:45:00Z"
}
```

**Response (200):** Updated protocol

---

### 10. TRACK ANALYTICS EVENT

**Endpoint:** `POST /api/analytics/events`

**Request:**
```json
{
  "event_name": "report_viewed",
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "properties": {
    "time_to_view_ms": 2300,
    "marker_count": 5
  }
}
```

**Response (201):**
```json
{
  "event_id": "event-123",
  "created_at": "2026-06-05T14:45:00Z"
}
```

---

## PAYWALL LOGIC

### 402 Payment Required Response Format

```json
{
  "error": "payment_required",
  "detail": "Upgrade to Premium to check in again",
  "reason": "free_tier_limit",
  "trial_available": true,
  "cta": "Start 7-day free trial",
  "pricing": "$9.99/month"
}
```

### Paywall Trigger Points

```
1. 2nd check-in attempt (free: 3 total)
   → POST /check-ins
   → Status 402
   → Frontend shows paywall modal

2. Attempt to view check-in history
   → GET /check-ins/history
   → Status 403
   → Frontend shows "Premium feature" message
```

---

## ERROR HANDLING

**All endpoints return:**

| Status | Case |
|--------|------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation) |
| 401 | Unauthorized (no JWT) |
| 402 | Payment required (free tier limit) |
| 403 | Forbidden (premium feature) |
| 404 | Not found |
| 500 | Server error |

**Example error:**
```json
{
  "detail": "Unauthorized",
  "error_code": "auth_required"
}
```

---

## RATE LIMITING

- `/check-ins`: 1 per day per user (soft limit)
- `/analytics/events`: 100 per minute per user
- Everything else: 100 per minute per user

---

## IMPLEMENTATION NOTES

1. **Use existing biomarker extraction** from PDF parsing
2. **Cache reports** — generate once, serve from cache
3. **Lazy-load protocol** — generate on-demand if not cached
4. **Soft delete everything** — deleted_at, never hard-delete
5. **Track all interactions** — every page view, click, action
6. **RLS on every query** — use current_user.id always
7. **Idempotent check-ins** — user can only create one per day

---

## DEPLOYMENT

```bash
# Add these endpoints to your FastAPI router
# Test each endpoint with curl/Postman
# Verify RLS policies work
# Load test with k6 or locust
# Monitor error rates
```
