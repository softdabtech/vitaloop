# EXECUTION SPEC #3: UX FLOW AFTER UPLOAD

**Screen:** Results Page (after PDF upload + parsing completes)  
**Flow:** Upload → Report → Protocol → Check-in Intro → Conversion

---

## USER JOURNEY (60 seconds to value)

```
User uploads PDF
        ↓
[Parsing in progress...]
        ↓
✅ SUCCESS: Report ready
        ↓
USER SEES RESULTS PAGE (THIS SPEC)
        ↓
T+0s:    See priority markers summary
T+5s:    Read explanation of first marker
T+15s:   See full action plan
T+30s:   Decide to track progress
T+60s:   First check-in started
```

---

## RESULTS PAGE LAYOUT

### DESKTOP (1025px+)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER                                                      │
│ ← Back | "Lab Results" | Jun 2, 2026 | Share | Download   │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  SECTION 1: PRIORITY SUMMARY (Hero)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🚨 4 Markers Need Attention                          │  │
│  │                                                      │  │
│  │ [Card] Ferritin: 12 μg/L (LOW)                     │  │
│  │ [Card] Vitamin D: 18 ng/mL (LOW)                   │  │
│  │ [Card] Magnesium: 1.8 mmol/L (LOW)                 │  │
│  │ [Card] TSH: 3.5 mIU/L (NORMAL)                     │  │
│  │                                                      │  │
│  │ ✓ 15 other markers are normal                       │  │
│  │                                                      │  │
│  │ [BUTTON] Track Progress Daily                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  SECTION 2: FULL RESULTS (Expandable)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ All Results (19 markers)  ▼                          │  │
│  │ Show: [Normal] [Low] [High] [Critical]              │  │
│  │                                                      │  │
│  │ [Table with all biomarkers]                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  SECTION 3: WHAT IT MEANS (Explanations) - Collapsed       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▼ Ferritin: 12 μg/L (Low)                          │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ What it means:                                 │  │  │
│  │ │ Ferritin measures iron stored in your body.   │  │  │
│  │ │ Low levels may cause fatigue, weak immune,    │  │  │
│  │ │ and hair loss.                                 │  │  │
│  │ │                                                │  │  │
│  │ │ Your value: 12 (lab's normal range: 30-150)  │  │  │
│  │ │ Status: CRITICALLY LOW                        │  │  │
│  │ │                                                │  │  │
│  │ │ What to discuss with your doctor:             │  │  │
│  │ │ □ Iron supplementation (25-50mg daily)        │  │  │
│  │ │ □ Underlying causes (absorption issues, etc)  │  │  │
│  │ │                                                │  │  │
│  │ │ ⚠️ Do not self-diagnose. Work with your MD.  │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │ ▼ Vitamin D: 18 ng/mL (Low)                        │  │
│  │ [Similar expandable card]                           │  │
│  │                                                      │  │
│  │ [+ 2 more markers...]                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  SECTION 4: PERSONAL ACTION PLAN - Collapsed               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▼ Your Action Plan                                 │  │
│  │                                                      │  │
│  │ Based on your results:                              │  │
│  │                                                      │  │
│  │ FERRITIN (Priority: HIGH)                          │  │
│  │ ├─ Lifestyle                                        │  │
│  │ │  ✓ Eat iron-rich foods 2-3x per week              │  │
│  │ │    (red meat, spinach, beans, fortified cereals) │  │
│  │ │                                                   │  │
│  │ │  ✓ Consume vitamin C with iron                    │  │
│  │ │    (orange juice, citrus, tomato sauce)          │  │
│  │ │                                                   │  │
│  │ ├─ Supplements (discuss with doctor)                │  │
│  │ │  ⚠️ Iron supplement: 25-50mg elemental iron      │  │
│  │ │     Take with vitamin C. Separate from tea/coffee │  │
│  │ │     Side effects: GI upset, constipation         │  │
│  │ │                                                   │  │
│  │ ├─ Timeline                                         │  │
│  │ │  Duration: 8 weeks                                │  │
│  │ │  Next retest: August 1, 2026                      │  │
│  │ │                                                   │  │
│  │ └─ Your doctor should:                              │  │
│  │    • Check for underlying causes                     │  │
│  │    • Monitor for side effects                        │  │
│  │    • Confirm supplementation plan                    │  │
│  │                                                      │  │
│  │ VITAMIN D (Priority: MEDIUM)                       │  │
│  │ [Similar structure]                                 │  │
│  │                                                      │  │
│  │ MAGNESIUM (Priority: MEDIUM)                       │  │
│  │ [Similar structure]                                 │  │
│  │                                                      │  │
│  │ TSH (Priority: LOW - Normal but monitoring)        │  │
│  │ [Similar structure]                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  SECTION 5: NEXT STEPS                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▼ What To Do Next                                  │  │
│  │                                                      │  │
│  │ 1. Track Your Progress                              │  │
│  │    Log daily check-ins (5 seconds each) to notice   │  │
│  │    improvements as you address deficiencies         │  │
│  │    [BUTTON] Start Check-In                          │  │
│  │                                                      │  │
│  │ 2. Schedule Your Retest                             │  │
│  │    Return here August 1 to upload new results       │  │
│  │    We'll send you a reminder.                       │  │
│  │                                                      │  │
│  │ 3. Work With Your Doctor                            │  │
│  │    Share this report and discuss action plan        │  │
│  │    [BUTTON] Download PDF Report                     │  │
│  │                                                      │  │
│  │ 💬 Questions? Contact support.                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└────────────────────────────────────────────────────────────┘

FOOTER:
Lab: Quest Diagnostics | Date: Jun 2, 2026 | Report: 12345
```

### MOBILE (320px - 640px)

```
Single column, all sections stack:

┌───────────────────────────┐
│ ← Results | Share | …     │
├───────────────────────────┤
│                            │
│ 🚨 4 Markers Need Care    │
│                            │
│ [Card - full width]        │
│ Ferritin: 12 (LOW)        │
│ [Card]                     │
│ Vitamin D: 18 (LOW)       │
│                            │
│ [BUTTON - full width]      │
│ Track Progress            │
│                            │
│ ▼ All Results             │
│ [Expandable]              │
│                            │
│ ▼ What It Means           │
│ [Expandable sections]     │
│                            │
│ ▼ Your Action Plan        │
│ [Expandable sections]     │
│                            │
│ ▼ Next Steps              │
│ [Expandable section]      │
│                            │
└───────────────────────────┘
```

---

## COMPONENT DETAILS

### PRIORITY MARKER CARD

```jsx
<div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100">
  {/* Status badge */}
  <div className="flex justify-between items-start mb-3">
    <h3 className="text-lg font-bold">Ferritin</h3>
    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
      CRITICAL
    </span>
  </div>
  
  {/* Value + range */}
  <div className="text-3xl font-bold text-gray-900 mb-2">
    12 <span className="text-lg text-gray-500">μg/L</span>
  </div>
  
  <div className="text-sm text-gray-600 mb-4">
    Normal range: 30-150 μg/L
  </div>
  
  {/* Visual progress bar (inverted for red) */}
  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
    <div className="h-full bg-red-500" style={{width: "8%"}}></div>
  </div>
  
  {/* What it might mean */}
  <p className="text-sm text-gray-700 mb-3">
    Low ferritin may cause fatigue, weak immune system, and hair loss
  </p>
  
  {/* CTA to expand details */}
  <button className="text-teal-600 text-sm font-semibold hover:underline">
    What this means →
  </button>
</div>
```

### EXPLANATION CARD (Expandable)

```jsx
<details className="border border-gray-200 rounded-lg p-4 mb-3">
  <summary className="cursor-pointer font-bold text-gray-900 flex justify-between">
    <span>Ferritin: 12 μg/L (Low)</span>
    <span>▼</span>
  </summary>
  
  <div className="mt-4 text-sm space-y-4 text-gray-700">
    
    <div>
      <strong>What it is:</strong>
      <p>Ferritin measures iron stored in your body. It's important for energy, immunity, and hair growth.</p>
    </div>
    
    <div>
      <strong>Your status:</strong>
      <p>Your ferritin is <span className="font-bold text-red-600">critically low</span> at 12 (normal: 30-150)</p>
    </div>
    
    <div>
      <strong>What may cause low ferritin:</strong>
      <ul className="list-disc list-inside space-y-1">
        <li>Inadequate iron intake</li>
        <li>Poor iron absorption (celiac, IBS)</li>
        <li>Blood loss</li>
        <li>Pregnancy</li>
      </ul>
    </div>
    
    <div>
      <strong>What to do:</strong>
      <p>Discuss with your doctor about:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Iron supplementation (25-50mg daily)</li>
        <li>Dietary changes (red meat, spinach)</li>
        <li>Underlying causes</li>
      </ul>
    </div>
    
    <div className="bg-amber-50 border border-amber-200 rounded p-3">
      <strong className="text-amber-900">⚠️ Important:</strong>
      <p className="text-amber-800 mt-1">This is educational information. Your doctor should diagnose and determine treatment.</p>
    </div>
    
  </div>
</details>
```

### ACTION PLAN SECTION

```jsx
<section className="border rounded-lg p-6">
  <h2 className="text-xl font-bold mb-6">Your Action Plan</h2>
  
  {/* For each priority marker */}
  {markers.map(marker => (
    <div key={marker.id} className="mb-8 pb-8 border-b last:border-b-0">
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold">{marker.name}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
          marker.priority === 1 ? 'bg-red-100 text-red-800' :
          marker.priority === 2 ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          Priority: {marker.priority === 1 ? 'HIGH' : 'MEDIUM'}
        </span>
      </div>
      
      {/* Lifestyle actions */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">What to do:</h4>
        {marker.lifestyle_actions.map((action, idx) => (
          <label key={idx} className="flex items-start mb-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input type="checkbox" className="mt-1 mr-3 accent-teal-500" />
            <div>
              <div className="font-semibold text-gray-900">{action.title}</div>
              <div className="text-sm text-gray-600">{action.description}</div>
            </div>
          </label>
        ))}
      </div>
      
      {/* Supplements (with disclaimer) */}
      {marker.supplements && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3">Supplements to discuss with doctor:</h4>
          <div className="text-sm text-blue-900">
            <p className="mb-2">{marker.supplements.description}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Typical dose: {marker.supplements.dose}</li>
              <li>Duration: {marker.supplements.duration_days} days</li>
              <li>Side effects: {marker.supplements.side_effects}</li>
            </ul>
            <p className="mt-3 text-xs text-blue-700">⚠️ Always discuss with your doctor before starting supplements. They may interact with medications.</p>
          </div>
        </div>
      )}
      
      {/* Timeline */}
      <div className="bg-teal-50 rounded-lg p-4">
        <h4 className="font-semibold text-teal-900 mb-2">Timeline</h4>
        <div className="text-sm text-teal-900">
          <p>Duration: <strong>{marker.duration_days} days</strong></p>
          <p>Retest date: <strong>{marker.retest_date}</strong></p>
          <p className="mt-2 text-xs">You'll get a reminder 1 week before.</p>
        </div>
      </div>
      
    </div>
  ))}
</section>
```

---

## INTERACTION FLOWS

### SCENARIO 1: User Scrolls Through Results

```
T+0s:  Page loads, user sees priority summary with 4 markers
T+3s:  User scrolls down to read "What It Means" section
T+8s:  User expands "Ferritin" explanation, reads details
T+15s: User scrolls to "Action Plan" section
T+25s: User sees timeline: "8 weeks"
T+30s: User sees CTA button "Track Progress Daily"
T+35s: User clicks button → Check-in modal appears
T+40s: User sees "Quick question: How are you feeling?"
T+50s: User selects "Better", hits Save
T+60s: Success: "Great! Come back tomorrow to track progress"

CONVERSION: User sees immediate value (what to do) + takes action (check-in)
```

### SCENARIO 2: User Just Wants Numbers

```
T+0s:  Page loads
T+2s:  User clicks "All Results" expand button
T+5s:  User sees full table of 19 markers
T+10s: User scrolls to action items section
T+20s: Sees "Share with doctor" button
T+25s: Clicks "Download PDF" to share with MD

CONVERSION: User gets what they came for (all numbers) + starts engagement loop
```

### SCENARIO 3: User is Skeptical

```
T+0s:  Page loads
T+5s:  User reads "Important: This is educational only" disclaimer
T+10s: User clicks on "Ferritin" explanation
T+15s: Reads "What to discuss with your doctor"
T+20s: Sees multiple options, not just one treatment
T+25s: Notices disclaimer: "Your doctor should diagnose"
T+30s: Decides to show doctor / get second opinion

CONVERSION: User trusts the product (not overstating claims)
```

---

## BUTTON PLACEMENT & LABELS

| Button | Location | State (Free) | State (Premium) |
|--------|----------|---|---|
| "Track Progress" | After priority summary | Visible, CTA blue | Visible, CTA blue |
| "Download PDF" | Next Steps section | Visible, secondary | Visible, secondary |
| "Share with Doctor" | Results header | Visible, secondary | Visible, secondary |
| "View History" | Check-in section | Disabled (paywall) | Enabled |

---

## PAYWALL MOMENT: AFTER 3RD CHECK-IN

```jsx
// If user tries to check-in 4th time on free tier:

<Modal>
  <h2>Track Your Progress More Frequently</h2>
  <p>You've used 3 free check-ins. Upgrade to Premium to:</p>
  <ul>
    <li>✓ Unlimited daily check-ins</li>
    <li>✓ See 30-day trends and patterns</li>
    <li>✓ Get retest reminders</li>
  </ul>
  
  <div className="pricing">
    <p><strong>Premium: $9.99/month</strong></p>
    <p className="text-sm text-gray-600">7-day free trial, cancel anytime</p>
  </div>
  
  <button className="bg-teal-600 text-white px-6 py-3 rounded-lg font-bold">
    Start Free Trial
  </button>
  
  <button className="text-teal-600 text-sm">
    Maybe later
  </button>
</Modal>
```

---

## KEY PRINCIPLES

1. **Show value immediately** — priority summary first
2. **Educate, don't diagnose** — "May cause" not "Causes"
3. **Multiple options** — lifestyle + supplements + medical
4. **Timeline clarity** — when to retest, how long to wait
5. **Doctor inclusion** — "Discuss with your doctor" in every action
6. **Safe disclaimers** — "Not medical advice" visible
7. **One clear CTA** — "Track Progress" button prominent
8. **Mobile-first** — expandable sections for mobile
9. **Paywall after value** — not before
10. **Trust > features** — regulatory safety over flashy design

---

## ANALYTICS EVENTS TO TRACK

```
report_viewed
├─ marker_count: 5
├─ priority_markers: 3
└─ has_critical: true

marker_expanded
├─ marker_name: "ferritin"
└─ read_time_ms: 5300

action_plan_viewed
├─ total_actions: 12
└─ priority_high_actions: 3

checkin_started
├─ from_cta: true
└─ scroll_depth: 0.4

checkin_completed
├─ mood: "better"
└─ had_details: false
```

---

## CURRENT IMPLEMENTATION STATUS

- ✅ Report backend (exists, may need modification)
- ❌ Insights generation (new)
- ❌ Protocol generation (new)
- ❌ Check-in frontend (new)
- ❌ Analytics tracking (new)

Start with backend endpoints, then build React components for this flow.
