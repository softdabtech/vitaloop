# EXECUTION SPEC #4: PAYWALL MATRIX

**Goal:** Convert users to paid after they understand value  
**Pricing:** $9.99/month (test $14.99 later)  
**Trial:** 7 days free

---

## FREE vs PREMIUM FEATURE MATRIX

```
FEATURE                              FREE    PREMIUM    NOTES
─────────────────────────────────────────────────────────────────

Upload & Parse PDF                   ✅      ✅         Core feature
View Lab Results (all biomarkers)    ✅      ✅         Must be free
Priority Markers Summary             ✅      ✅         Value proposition
Marker Explanations                  ✅      ✅         Educational
Action Plan / Recommendations        ✅      ✅         Core value

─ PAYWALL LINE (Above = free, below = paid) ─

Daily Check-In Tracking              ❌*     ✅         *3 free, then gate
Check-In Trends (30-day history)     ❌      ✅         Premium only
Mood Tracking Archive                ❌      ✅         Premium only
Retest Reminders                     ❌      ✅         Premium only
Compare Reports (history)            ❌      ✅         Future feature
Download PDF Report                  ✅      ✅         Free for value
Share Report with Doctor             ✅      ✅         Free for value

Export as CSV                        ❌      ✅         Premium
Mobile App (future)                  ❌      ✅         Premium tier
Wearable Integration (future)        ❌      ✅         Premium tier
Lab Booking (future)                 ❌      ✅         Premium tier
AI Recommendations (future)          ❌      ✅         Premium tier
```

---

## PAYWALL TRIGGERS

### TRIGGER #1: Check-In Limit (Primary)

**When:** User attempts to create check-in #4

**Current data:**
```python
user.free_checkins_used = 3
user.tries_to_create_checkin()
→ Status: 402 Payment Required
```

**Modal shown to user:**
```
┌─────────────────────────────────────┐
│  Track Your Progress More Often     │
├─────────────────────────────────────┤
│                                     │
│  You've used 3 free check-ins.     │
│  Upgrade to track daily progress.   │
│                                     │
│  WITH PREMIUM:                      │
│  ✓ Unlimited daily check-ins        │
│  ✓ See 30-day mood trends           │
│  ✓ Get retest reminders             │
│  ✓ Track energy, sleep, mood        │
│                                     │
│  $9.99/month                        │
│  ↳ 7-day free trial (no card)      │
│  ↳ Cancel anytime                   │
│                                     │
│  [START FREE TRIAL]  [Later]        │
│                                     │
└─────────────────────────────────────┘
```

**Payload (HTTP 402):**
```json
{
  "error": "payment_required",
  "detail": "Free tier limited to 3 check-ins. Upgrade to Premium.",
  "reason": "free_tier_limit_exceeded",
  "triggered_by": "check_in_creation",
  "free_checkins_allowed": 3,
  "free_checkins_used": 3,
  "trial_available": true,
  "trial_days": 7,
  "pricing": {
    "monthly": 9.99,
    "currency": "USD"
  }
}
```

**Frontend handling:**
```jsx
// In Check-In component
async function handleCheckInSubmit() {
  try {
    await createCheckIn(data)
  } catch (error) {
    if (error.status === 402) {
      // Show paywall modal
      showPaywallModal({
        reason: error.payload.reason,
        trial_days: error.payload.trial_days,
        pricing: error.payload.pricing
      })
    }
  }
}
```

---

### TRIGGER #2: Check-In History Access (Secondary)

**When:** User clicks "View History" or "See Trends"

**Current data:**
```python
if not user.is_premium:
    return HTTPException(status_code=403, detail="Premium feature")
```

**Modal shown to user:**
```
┌─────────────────────────────────────┐
│  See Your 30-Day Trends             │
├─────────────────────────────────────┤
│                                     │
│  Upgrade to Premium to see:         │
│  • Mood trends (line chart)         │
│  • Energy patterns (30 days)        │
│  • Sleep improvements               │
│  • How you're progressing           │
│                                     │
│  [START FREE TRIAL]                 │
│                                     │
└─────────────────────────────────────┘
```

---

## FREE TIER LIMITS

```
Limit                          Value          Reset
─────────────────────────────────────────────────────
Check-ins per account          3 total        None (convert to premium)
PDF uploads per month          1              Monthly (free tier)
Report downloads               Unlimited      None
Share reports                  Unlimited      None
Check-in history days visible  None           N/A
Retest reminders               None           N/A
```

---

## PREMIUM TIER BENEFITS

**Primary benefits (why users convert):**
1. **Unlimited check-ins** — Track daily, see patterns
2. **30-day trends** — Mood, energy, sleep graphs
3. **Retest reminders** — Never miss optimal retest timing
4. **Full history** — Compare reports over time

**Secondary benefits (add value):**
- Download PDF reports
- Share with doctor (future: annotations)
- Export as CSV
- No ads
- Priority support

---

## PRICING STRATEGY

### Primary Price: $9.99/month

**Rationale:**
- Competitive: InsideTracker ($199/year = $16.58/mo), but we're lighter
- Accessible: Under $10 encourages trial
- Percieved as affordable add-on (like Spotify)
- 2-3 years to break even on customer acquisition

**Pricing tests (Week 8+):**
- Variant A: $9.99/month (current)
- Variant B: $14.99/month (test LTV)
- Variant C: $19.99/month (premium segment test)

---

## TRIAL MECHANICS

### 7-Day Free Trial

**What user sees:**
```
✓ Full Premium access for 7 days
✓ NO credit card required (to reduce friction)
✓ Auto-converts to paid after 7 days (with reminder)
✓ Can cancel anytime
```

**No-card approach:**
- User enters email → Gets promo code
- Code auto-applies 7-day access
- Day 6: Email reminder "Your trial ends tomorrow"
- Day 7: "Ready to continue? $9.99/month"
- Day 8: Requires payment if user wants to continue

**Alternative: Credit card upfront**
- Simpler for engineering (standard Stripe)
- Higher conversion (committed users)
- Lower initial signups (friction)
- Decision: Test both, see which converts better

### Converting Trial → Paid

```
Day 0:
User clicks "Start Free Trial"
→ Shows payment method choice:
  ✓ Trial (no card, email-based)
  ✓ Subscribe Now (card required)

Day 6 (if no-card trial):
Email: "Your trial ends tomorrow. Continue Premium?"
→ Click link → Payment form

Day 7:
If not paid → Reverts to Free tier
User can still check-in (but limited)

Day 8+:
Show gentle upsell: "Upgrade to see trends"
```

---

## CONVERSION FUNNEL METRICS

**Target conversion rates:**
```
All users who upload PDF
    ↓
100% see results

See results
    ↓
40% start check-in (see CTA)
    ↓
100% of check-in starters can do 3 free

3+ check-ins completed
    ↓
60% see paywall (try 4th check-in)
    ↓
20% start free trial (from paywall)
    ↓
50% convert from trial to paid (10% of total)

Expected: 10% of users convert to paid within 30 days
```

**MRR projection:**
```
1,000 users/month sign up
× 40% activate (check-in)         = 400
× 10% convert to premium           = 40
× $9.99/month                      = $399.60 MRR

3,000 users/month:
× 40% activate                     = 1,200
× 10% convert                      = 120
× $9.99                            = $1,198.80 MRR

10,000 users/month:
× 40% activate                     = 4,000
× 10% convert                      = 400
× $9.99                            = $3,996 MRR
```

---

## PAYWALL COPY (DO's & DON'Ts)

### ✅ DO SAY:

- "Upgrade to see your trends"
- "Get unlimited check-ins"
- "Premium: Track daily progress"
- "Start free trial (7 days)"
- "$9.99/month"

### ❌ DON'T SAY:

- "You've hit your limit" (negative)
- "Unlock premium features" (artificial urgency)
- "Limited time offer" (dishonest if not true)
- "Subscribe now!" (pushy)
- "Free to access basic results" (confusing)

### ✅ TONE:

- Helpful ("Here's what you get with Premium...")
- Honest ("This is a premium feature...")
- Non-intrusive (easy "Maybe later" button)
- Value-focused (benefits first, price second)

---

## STRIPE INTEGRATION CHECKLIST

```
[ ] Create product "Vitaloop Premium" in Stripe
[ ] Set up $9.99/month recurring subscription
[ ] Create discount code "TRIAL7" (7 days free)
[ ] Set up webhook for subscription events
[ ] Handle webhook: customer.subscription.created
[ ] Handle webhook: customer.subscription.updated
[ ] Handle webhook: customer.subscription.deleted
[ ] Store subscription_id in user profile
[ ] Check subscription status before serving premium features
[ ] Set up email reminder (Day 6 of trial)
[ ] Handle failed payments (email user, pause features)
[ ] Set up admin dashboard to monitor subscriptions
```

---

## EMAIL SEQUENCES

### Trial Started
```
Subject: Welcome to Vitaloop Premium! 🎉

Hi [Name],

You now have 7 days of Premium access, including:
✓ Unlimited daily check-ins
✓ 30-day mood trends
✓ Retest reminders
✓ Full history

Get started:
1. Check in today to track your mood
2. Come back tomorrow for trends
3. See how your energy improves

Questions? Reply to this email.

[View App]
```

### Day 6 Reminder
```
Subject: Your trial expires tomorrow ⏰

Hi [Name],

Your 7-day Premium trial ends tomorrow. 

Would you like to continue? 
✓ $9.99/month
✓ Cancel anytime
✓ See your 30-day trends

[Continue Premium] [Maybe Later]

P.S. You've tracked 5 check-ins. Keep going!
```

### Trial Expired (if not converted)
```
Subject: We miss you 👋

Hi [Name],

Your Premium trial ended. We hope you found value.

Your 3 free check-ins are still available.

If you'd like to continue tracking daily:
[Upgrade to Premium - $9.99/month]

[Not Now]
```

### Payment Failed
```
Subject: We couldn't process your payment

Hi [Name],

Your card was declined. Your Premium access is temporarily paused.

Update your payment method:
[Update Payment]

Questions? Contact support@vitaloop.today

Thanks,
Vitaloop
```

---

## COMPLIANCE CHECKLIST

- [ ] Stripe terms & conditions shown before checkout
- [ ] Cancel subscription easy (Settings > Billing > Cancel)
- [ ] Refund policy: 14-day money-back guarantee
- [ ] Receipt emailed after each payment
- [ ] Invoice available in dashboard
- [ ] Payment method update is self-service
- [ ] Billing cycle start/end clearly shown
- [ ] Confirmation before charging payment method
- [ ] GDPR compliant (EU users: soft consent to email)

---

## A/B TESTING ROADMAP

### Test 1: Trial vs No-Trial (Immediate)
- Control: $9.99/month (no trial)
- Variant: 7-day free trial (no card)
- Metric: Conversion rate to paid
- Duration: 2 weeks, 500+ signups per variant

### Test 2: Pricing (Week 4)
- Control: $9.99/month
- Variant: $14.99/month
- Metric: Conversion rate, LTV, churn
- Duration: 4 weeks

### Test 3: Paywall copy (Week 6)
- Control: "Upgrade to see trends"
- Variant: "Continue tracking with Premium"
- Metric: Click-through rate
- Duration: Continuous

---

## IMPLEMENTATION CHECKLIST

**Backend:**
- [ ] Add subscription_status column to users
- [ ] Add is_premium computed from subscription status
- [ ] Create Stripe webhook handler
- [ ] Add 402 error response format
- [ ] Add feature gate checks (is_premium checks)
- [ ] Add trial expiration logic

**Frontend:**
- [ ] Create PaywallModal component
- [ ] Add error handling for 402/403 responses
- [ ] Add "Start Free Trial" button to paywall
- [ ] Integrate with Stripe Checkout
- [ ] Add subscription status to user settings
- [ ] Add analytics tracking for paywall
- [ ] Add email integration for reminders

**Stripe:**
- [ ] Create product + pricing
- [ ] Set up webhooks
- [ ] Configure email receipts
- [ ] Test trial flow end-to-end
- [ ] Test payment flow end-to-end

**Legal:**
- [ ] Add terms of service (subscription)
- [ ] Add privacy policy updates
- [ ] Add refund policy (14 days)
- [ ] Get legal review of paywall copy

---

## GO-LIVE CHECKLIST

Week 5 (before paywall launch):
- [ ] All endpoints working (402, 403 responses)
- [ ] Stripe webhooks verified
- [ ] Email sequences drafted
- [ ] Legal review complete
- [ ] Pricing finalized
- [ ] Analytics events configured
- [ ] Paywall modal designed
- [ ] Payment flow tested with test card
- [ ] Refund flow tested
- [ ] Support documentation written
- [ ] Support team trained

Week 6:
- [ ] Enable feature for 10% of users (gradual rollout)
- [ ] Monitor paywall click rate (target: >50%)
- [ ] Monitor conversion rate (target: >5%)
- [ ] Monitor payment errors (target: <1%)
- [ ] Ramp to 100% if all metrics healthy

---

## SUCCESS METRICS

**Week 1-2 (Post-launch):**
- Paywall shown to 50%+ of check-in users
- Paywall CTR: >40%
- Trial start rate: >20% of paywall users
- Payment success rate: >95%

**Week 3-4:**
- Trial to paid conversion: >30%
- Churn (cancel within 30 days): <10%
- MRR: $500+ (100+ active subscribers)

**Month 2:**
- Premium users: 200-300
- MRR: $2,000+
- CAC payback: <60 days
- LTV: >$100

---

## NOTES

1. **No dark patterns** — Don't force trial card, don't hide cancel button
2. **Easy cancellation** — User can cancel from settings in 2 clicks
3. **Value-first** — Show benefits, not just price
4. **One paywall** — Only check-in limit triggers paywall, not multiple things
5. **Test prices** — $9.99 is hypothesis, test $14.99+ later
6. **Monitor churn** — If >15% cancel, pricing or offering may be wrong
7. **Track LTV** — Subscription revenue should exceed customer acquisition cost

This is a **sustainable, compliant, user-friendly monetization strategy** for the 6-week iteration.
