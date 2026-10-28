# EXECUTION SPEC #6: ANALYTICS EVENT MAP

**Purpose:** Track core user journey: upload → insight → action → conversion  
**Tool:** Mixpanel, Segment, or equivalent  
**Frequency:** Real-time event tracking, daily reporting

---

## ANALYTICS ARCHITECTURE

```
Frontend events → Event SDK → Analytics Service → Dashboard
  (page.js)        (Mixpanel)    (Vitaloop API)    (Analyze)
  
All events include:
├─ event_name
├─ user_id (always)
├─ timestamp
├─ session_id
├─ user_agent (device, browser)
└─ properties (custom per event)
```

---

## CORE FUNNEL EVENTS

### Stage 1: Upload Completion

**Event: `upload_started`**
```json
{
  "event_name": "upload_started",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:00:00Z",
  "properties": {
    "source": "dashboard",  // where they initiated upload
    "file_type": "pdf",
    "file_size_kb": 245
  }
}
```

**Event: `upload_completed`**
```json
{
  "event_name": "upload_completed",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:05:00Z",
  "properties": {
    "duration_seconds": 300,  // time from start to completion
    "lab_name": "Quest Diagnostics",
    "biomarker_count": 19,
    "priority_markers_count": 4,  // how many are out of range
    "file_size_kb": 245
  }
}
```

**Event: `upload_failed`**
```json
{
  "event_name": "upload_failed",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:05:00Z",
  "properties": {
    "error_type": "parsing_failed",  // or invalid_format, etc
    "error_message": "PDF corruption detected",
    "duration_seconds": 300
  }
}
```

---

### Stage 2: Report Viewing

**Event: `report_viewed`**
```json
{
  "event_name": "report_viewed",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:08:00Z",
  "properties": {
    "time_to_view_seconds": 180,  // from upload completion to view
    "device": "desktop",  // or mobile
    "biomarker_count": 19,
    "priority_markers_visible": 4,
    "scroll_depth_percent": 45  // how far down the page
  }
}
```

**Event: `priority_markers_viewed`**
```json
{
  "event_name": "priority_markers_viewed",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:10:00Z",
  "properties": {
    "marker_count": 4,
    "markers": ["ferritin", "vitamin_d", "magnesium", "tsh"],
    "time_on_section_seconds": 45
  }
}
```

---

### Stage 3: Results Deep-Dive

**Event: `marker_details_opened`**
```json
{
  "event_name": "marker_details_opened",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:12:00Z",
  "properties": {
    "marker_name": "ferritin",
    "marker_value": 12,
    "marker_status": "critical",
    "card_position": 1  // which card on the page
  }
}
```

**Event: `all_results_expanded`**
```json
{
  "event_name": "all_results_expanded",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:15:00Z",
  "properties": {
    "biomarker_count": 19,
    "filter_applied": "high"  // if they filtered by status
  }
}
```

---

### Stage 4: Protocol/Action Plan

**Event: `protocol_viewed`**
```json
{
  "event_name": "protocol_viewed",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:20:00Z",
  "properties": {
    "marker_count": 4,
    "action_count": 12,
    "high_priority_actions": 3,
    "time_on_section_seconds": 120
  }
}
```

**Event: `protocol_action_clicked`**
```json
{
  "event_name": "protocol_action_clicked",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:22:00Z",
  "properties": {
    "marker_name": "ferritin",
    "action_type": "lifestyle",  // or supplement, medical
    "action_text": "Eat iron-rich foods",
    "action_index": 1
  }
}
```

**Event: `protocol_action_marked_done`**
```json
{
  "event_name": "protocol_action_marked_done",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:25:00Z",
  "properties": {
    "marker_name": "ferritin",
    "action_type": "lifestyle",
    "action_text": "Eat iron-rich foods",
    "days_to_mark_done": 3  // days after protocol created
  }
}
```

---

### Stage 5: Check-In (Critical for Conversion)

**Event: `checkin_modal_opened`**
```json
{
  "event_name": "checkin_modal_opened",
  "user_id": "user-123",
  "upload_id": "upload-456",
  "timestamp": "2026-06-05T14:30:00Z",
  "properties": {
    "source": "cta_button",  // where they opened from
    "time_since_report_view_seconds": 360
  }
}
```

**Event: `checkin_started`**
```json
{
  "event_name": "checkin_started",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:31:00Z",
  "properties": {
    "checkin_number": 1,  // is this their 1st, 2nd, 3rd check-in?
    "upload_id": "upload-456"
  }
}
```

**Event: `checkin_expanded_details`**
```json
{
  "event_name": "checkin_expanded_details",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:32:00Z",
  "properties": {
    "checkin_number": 1,
    "expanded_fields": ["fatigue", "sleep", "energy"],
    "from_mood_only": true
  }
}
```

**Event: `checkin_completed`**
```json
{
  "event_name": "checkin_completed",
  "user_id": "user-123",
  "checkin_id": "checkin-789",
  "timestamp": "2026-06-05T14:35:00Z",
  "properties": {
    "checkin_number": 1,  // 1st, 2nd, 3rd, etc
    "mood": "better",  // better, same, worse
    "had_details": true,  // filled in fatigue/energy/sleep
    "time_to_complete_seconds": 45,
    "days_since_upload": 0,
    "free_checkins_remaining": 2  // if on free tier
  }
}
```

**Event: `checkin_pattern_shown`**
```json
{
  "event_name": "checkin_pattern_shown",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:36:00Z",
  "properties": {
    "checkin_count": 7,
    "pattern_type": "improving",  // or stable, worsening
    "pattern_description": "Mood improving over 7 days"
  }
}
```

---

### Stage 6: Paywall (Critical for Revenue)

**Event: `paywall_shown`**
```json
{
  "event_name": "paywall_shown",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:36:00Z",
  "properties": {
    "triggered_by": "checkin_limit_exceeded",  // or history_view_attempt
    "free_checkins_used": 3,
    "free_checkins_allowed": 3,
    "paywall_type": "modal"  // or banner
  }
}
```

**Event: `paywall_cta_clicked`**
```json
{
  "event_name": "paywall_cta_clicked",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:37:00Z",
  "properties": {
    "triggered_by": "checkin_limit_exceeded",
    "cta_text": "Start Free Trial",
    "cta_position": "primary"
  }
}
```

**Event: `trial_started`**
```json
{
  "event_name": "trial_started",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:40:00Z",
  "properties": {
    "trial_days": 7,
    "requires_card": false,  // or true
    "from_paywall": true
  }
}
```

**Event: `payment_attempted`**
```json
{
  "event_name": "payment_attempted",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:42:00Z",
  "properties": {
    "amount": 9.99,
    "currency": "USD",
    "payment_method": "card",
    "source": "trial_expiration"  // or paywall, settings
  }
}
```

**Event: `payment_succeeded`**
```json
{
  "event_name": "payment_succeeded",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:43:00Z",
  "properties": {
    "amount": 9.99,
    "currency": "USD",
    "subscription_id": "sub-123",
    "plan": "premium_monthly",
    "billing_cycle_start": "2026-06-05",
    "billing_cycle_end": "2026-07-05"
  }
}
```

**Event: `payment_failed`**
```json
{
  "event_name": "payment_failed",
  "user_id": "user-123",
  "timestamp": "2026-06-05T14:43:00Z",
  "properties": {
    "amount": 9.99,
    "error_code": "card_declined",
    "error_message": "Card was declined",
    "retry_count": 1
  }
}
```

**Event: `subscription_canceled`**
```json
{
  "event_name": "subscription_canceled",
  "user_id": "user-123",
  "timestamp": "2026-06-10T10:00:00Z",
  "properties": {
    "subscription_id": "sub-123",
    "days_active": 5,
    "cancellation_reason": "not_using",  // if user provides reason
    "reason_text": "I wasn't using it regularly"
  }
}
```

---

## SECONDARY EVENTS

**Event: `email_opened`**
```json
{
  "event_name": "email_opened",
  "user_id": "user-123",
  "timestamp": "2026-06-05T18:30:00Z",
  "properties": {
    "email_type": "retest_reminder",
    "email_number": 1,
    "days_since_upload": 10
  }
}
```

**Event: `email_clicked`**
```json
{
  "event_name": "email_clicked",
  "user_id": "user-123",
  "timestamp": "2026-06-05T18:35:00Z",
  "properties": {
    "email_type": "retest_reminder",
    "link_text": "Schedule Lab Appointment",
    "link_url": "/book-test"
  }
}
```

**Event: `notification_received`**
```json
{
  "event_name": "notification_received",
  "user_id": "user-123",
  "timestamp": "2026-06-05T18:00:00Z",
  "properties": {
    "notification_type": "daily_checkin_reminder",
    "time_sent": "6:00 PM"
  }
}
```

**Event: `notification_clicked`**
```json
{
  "event_name": "notification_clicked",
  "user_id": "user-123",
  "timestamp": "2026-06-05T18:05:00Z",
  "properties": {
    "notification_type": "daily_checkin_reminder",
    "time_to_click_seconds": 300,
    "destination": "/check-in"
  }
}
```

---

## IMPLEMENTATION: EVENT TRACKING CODE

### In React Components

```jsx
// src/hooks/useAnalytics.ts
import { useEffect } from 'react'

export function useAnalytics() {
  const trackEvent = (eventName, properties = {}) => {
    if (window.mixpanel) {
      window.mixpanel.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        session_id: sessionStorage.getItem('session_id')
      })
    }
  }
  
  return { trackEvent }
}

// Usage in component:
function ReportPage() {
  const { trackEvent } = useAnalytics()
  
  useEffect(() => {
    trackEvent('report_viewed', {
      upload_id: uploadId,
      device: isMobile ? 'mobile' : 'desktop',
      biomarker_count: biomarkers.length
    })
  }, [uploadId])
  
  const handleMarkerClick = (markerName) => {
    trackEvent('marker_details_opened', {
      marker_name: markerName,
      upload_id: uploadId
    })
  }
  
  return (
    <div onClick={() => handleMarkerClick('ferritin')}>
      {/* ... */}
    </div>
  )
}
```

### In Backend (Python/FastAPI)

```python
# app/utils/analytics.py
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import AnalyticsEvent

def track_event(db: Session, user_id: str, event_name: str, properties: dict = None):
    """Track analytics event in database"""
    
    event = AnalyticsEvent(
        user_id=user_id,
        event_name=event_name,
        properties=properties or {},
        created_at=datetime.utcnow()
    )
    
    db.add(event)
    db.commit()
    
    # Also send to Mixpanel if configured
    if MIXPANEL_TOKEN:
        mixpanel.track(user_id, event_name, properties)

# Usage in endpoint:
@router.post("/check-ins")
async def create_checkin(
    data: CheckInData,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    checkin = CheckIn(...)
    db.add(checkin)
    db.commit()
    
    track_event(db, current_user.id, "checkin_completed", {
        "checkin_number": user_checkin_count,
        "mood": data.mood,
        "had_details": data.fatigue_level is not None
    })
    
    return checkin
```

---

## DASHBOARD METRICS & DASHBOARDS

### Main Dashboard (Daily)

```
KEY METRICS:
├─ Signups (today, 7-day)
├─ Uploads (today, 7-day, avg per user)
├─ Report Views (% of uploads)
├─ Check-in Completion Rate (% of report viewers)
├─ Paywall Triggers (count, % of check-in users)
├─ Premium Conversions (count, %)
└─ MRR (monthly recurring revenue)

FUNNELS:
├─ Signup → Upload → Report → Check-in → Paywall → Conversion
├─ Upload → Report (% conversion, avg time)
├─ Report → Check-in (% conversion, avg time)
├─ Check-in → Paywall (% hit limit)
└─ Paywall → Conversion (% trial, % paid, avg $ per paid)

RETENTION:
├─ 1-day active (back next day)
├─ 7-day active (back within 7 days)
├─ 30-day active
└─ Churn rate (% who canceled subscription)

ENGAGEMENT:
├─ Avg check-ins per active user
├─ Avg protocol actions completed
├─ Avg retest scheduled
└─ Email open rate / click rate
```

### Conversion Funnel (Weekly)

```
Week Starting: 2026-06-02

Signups:           1,000 (100%)
  ↓
Uploaded PDF:        650 (65%)
  ↓
Viewed Report:       585 (90% of uploads)
  ↓
Started Check-in:    234 (40% of report viewers)
  ↓
Completed 1 CI:      189 (81% of starters)
  ↓
Completed 3 CI:      120 (63% of completers)
  ↓
Hit Paywall:         108 (90% of 3+ users)
  ↓
Started Trial:        24 (22% of paywall)
  ↓
Converted Paid:      12 (50% of trial, 1.2% of signups)

MRR: 12 × $9.99 = $119.88 (for this week's cohort)
```

### Cohort Retention (Monthly)

```
Cohort        Signup  1-Day   7-Day  30-Day  60-Day
June Week 1   1,000   450     280    120     65
June Week 2   1,200   540     300    140     -
June Week 3   950     428     250    -       -
June Week 4   1,100   495     -      -       -

Insight: 7-day retention ~24%, 30-day ~12% (for paid users)
```

---

## ALERTS & ANOMALIES

**Alert if:**
- Conversion rate drops >20% (sudden paywall issue?)
- Payment success rate <95% (payment provider down?)
- Email open rate drops <15% (content issue?)
- Check-in completion rate <60% (UX issue?)
- Report view time >30 min (confusion? slow page?)
- Trial to paid conversion <30% (offer problem?)

---

## PRIVACY & COMPLIANCE

**What NOT to track:**
- ❌ Health data (biomarker values themselves)
- ❌ User names or emails (use hashed user_id)
- ❌ Payment card details
- ❌ Doctor names

**What IS safe to track:**
- ✅ User IDs (hashed/anonymized)
- ✅ Feature interactions (click, view, engagement)
- ✅ Conversion events (trial started, paid)
- ✅ Funnel metrics (step completed, time spent)
- ✅ Error events (payment failed, upload error)

**GDPR compliance:**
- User can request data deletion (delete from analytics_events table)
- Events have retention period (180 days, then archive)
- No health data in analytics, only events

---

## ANALYTICS STACK

**Tool options:**
1. **Mixpanel** — Best for funnels, retention, cohorts
2. **Amplitude** — Similar to Mixpanel, more flexible
3. **Segment** — Event router (sends to multiple tools)
4. **PostHog** — Open-source, privacy-first, self-hosted
5. **Plausible** — Simple, privacy-focused, GDPR compliant

**Recommendation:** Start with Mixpanel (free tier, 5K events/month) + self-hosted analytics_events table.

---

## IMPLEMENTATION TIMELINE

**Week 1:**
- [ ] Set up Mixpanel account
- [ ] Create 6 main events (upload, report, checkin, paywall, payment, etc)
- [ ] Deploy tracking code to frontend
- [ ] Deploy tracking code to backend
- [ ] Test events in Mixpanel dashboard

**Week 2:**
- [ ] Create main dashboard (funnel, retention, metrics)
- [ ] Set up alerts for anomalies
- [ ] Daily sync with product team
- [ ] Adjust event properties based on needs

**Week 3+:**
- [ ] Monitor metrics daily
- [ ] A/B testing setup (if pricing test)
- [ ] Weekly cohort analysis
- [ ] Monthly reporting

---

## SUCCESS CRITERIA

**By Week 6 (Launch):**
- ✅ 100% of key events tracked
- ✅ 99%+ data accuracy
- ✅ <2 sec latency (event to dashboard)
- ✅ No privacy/compliance issues
- ✅ Dashboards operational
- ✅ Team using data for decisions

This analytics map is the **measurement system** for your iteration.
Without it, you're flying blind.

Every metric on this page should be watched weekly.
