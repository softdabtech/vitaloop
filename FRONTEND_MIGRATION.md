# Frontend Migration Guide - Single Source of Truth

## Overview
Complete migration from scattered frontend logic to backend-driven architecture.

## 1. Results.jsx - Biomarker Normalization

### Current State
- Fetches `/results/{uploadId}`
- Calls `normalizeBiomarkerStatus()` on frontend
- STATUS_META hardcoded locally
- Logic duplicated with backend

### Migration Steps

**Step 1: Replace data fetching**
```jsx
// OLD
const [biomarkers, setBiomarkers] = useState([])
useEffect(() => {
  api.get(`/results/${uploadId}`).then(res => setBiomarkers(res.data.biomarkers))
}, [uploadId])

// NEW
import { useBiomarkerNormalize } from '@/hooks/useQueries'

const { data: biomarkerData, isLoading } = useBiomarkerNormalize(uploadId)
const biomarkers = biomarkerData?.biomarkers || []
```

**Step 2: Remove normalization logic**
```jsx
// DELETE these functions - they're now on backend
// - normalizeBiomarkerStatus()
// - computeRangePercent()
// - infer_status_from_range()
// - STATUS_META (request styling from backend)

// DELETE this code
const normalizedBiomarkers = biomarkers.map(b => {
  const normalizedStatus = normalizeBiomarkerStatus(b)
  return { ...b, status_normalized: normalizedStatus }
})

// KEEP biomarkers as-is, they already contain:
// - status (normalized)
// - color (CSS color name)
// - badge (Tailwind classes)
// - severity_rank (for sorting)
```

**Step 3: Update rendering**
```jsx
// OLD: {STATUS_META[status]?.badge}
// NEW: {b.badge} (directly from backend)

// OLD: scoreStatus(b.status_normalized)
// NEW: b.severity_rank (already numeric)

// OLD: Check for 'DEFICIENT'/'ELEVATED'
// NEW: Check severity_rank < 2 (0=deficient, 1=elevated, 2-3=ok)
```

---

## 2. Update Other Result-Consuming Pages

Search and replace in all pages that display biomarkers:

```bash
# Find all files that import/use normalizeBiomarkerStatus
grep -r "normalizeBiomarkerStatus\|STATUS_META" frontend/src/pages frontend/src/components

# Files to update:
# - pages/Results.jsx (PRIMARY - see above)
# - pages/Insights.jsx
# - components/BiomarkerChart.jsx
# - components/BiomarkerAlertsDisplay.jsx (check if it uses backend data)
```

---

## 3. Entitlements + FeatureGate Migration

### Current State
```jsx
// Scattered across many files:
- <PremiumRoute>
- <Paywall/>
- LockedFeatureOverlay
- require_active_subscription()
- require_freemium_analyze()
```

### Migration

**Step 1: Replace PremiumRoute**
```jsx
// OLD
import PremiumRoute from '@/components/PremiumRoute'

<PremiumRoute>
  <InsightsPage />
</PremiumRoute>

// NEW
import { FeatureGate } from '@/components/FeatureGate'

<FeatureGate feature="insights" onLocked={showPaywall}>
  <InsightsPage />
</FeatureGate>
```

**Step 2: Replace Paywall component**
```jsx
// OLD
import Paywall from '@/components/Paywall'
if (!isActive) return <Paywall feature="insights" />

// NEW
import { useFeature } from '@/components/FeatureGate'

const { hasAccess } = useFeature('insights')
if (!hasAccess) return <PaywallModal feature="insights" />
```

**Step 3: Feature check list**
Available features from `/user/entitlements`:
- `uploads` (free: 1, premium: ∞)
- `dashboard` (all tiers)
- `insights` (premium+)
- `protocols` (premium+)
- `assignments` (premium+)
- `crm` (enterprise only)

---

## 4. Components to Update (Priority Order)

### High Priority
1. **Results.jsx** - PRIMARY, used everywhere
2. **UserDashboard.jsx** - Core page
3. **Insights.jsx** - Major feature gate

### Medium Priority
4. **InsightsPage.jsx** - If separate from Insights.jsx
5. **ProtocolPage.jsx** - Feature gated
6. **BiomarkerAlertsDisplay.jsx** - Uses biomarker data

### Low Priority
7. **HowItWorks.jsx** - Example page
8. **BiomarkerChart.jsx** - Chart component

---

## 5. Query Hook Integration

All these pages should be updated to use React Query hooks:

```jsx
// Dashboard
import { useDashboardSummary } from '@/hooks/useQueries'
const { data: summary } = useDashboardSummary()

// Progress
import { useProgress } from '@/hooks/useQueries'
const { data: progress } = useProgress()

// Insights
import { useInsights } from '@/hooks/useQueries'
const { data: insights } = useInsights()

// Lab Results
import { useBiomarkerNormalize } from '@/hooks/useQueries'
const { data: biomarkerData } = useBiomarkerNormalize(labId)

// Entitlements (for FeatureGate)
import { useUserEntitlements } from '@/hooks/useQueries'
const { data: entitlements } = useUserEntitlements()
```

---

## 6. Remove Duplicate Functions

After migration, delete these from codebase:

```bash
# In Results.jsx
- STATUS_META constant
- normalizeBiomarkerStatus()
- computeRangePercent()
- infer_status_from_range()
- scoreStatus()
- toEnglishBiomarkerName() (if backend returns English names)

# In useSubscription.js (likely dead after FeatureGate)
- Check if still needed
- If not, remove and use useUserEntitlements() instead
```

---

## 7. Testing Checklist

### Unit Tests
- [ ] FeatureGate blocks/shows content correctly
- [ ] useFeature hook returns correct access
- [ ] useBiomarkerNormalize returns enriched data
- [ ] Biomarker sorting by severity_rank works

### Integration Tests
- [ ] Free user can't access insights
- [ ] Premium user sees all features
- [ ] Entitlements cached for 30 mins
- [ ] Biomarker data cached for 5 mins
- [ ] Manual click refreshes data

### Manual Testing
- [ ] Open DevTools → React Query tab
- [ ] Verify cache hits on page navigation
- [ ] Check that feature gates work
- [ ] Verify biomarker styling displays correctly
- [ ] Test on slow network (Network tab → Slow 4G)

---

## 8. Implementation Order

1. **Day 1**: Backend review + Results.jsx migration
2. **Day 2**: FeatureGate component + PremiumRoute replacement
3. **Day 3**: Migrate UserDashboard, Progress, Insights
4. **Day 4**: Cleanup, testing, docs
5. **Day 5**: Merge & monitor production

---

## Performance Impact (Expected)

| Metric | Before | After |
|--------|--------|-------|
| Results.jsx load | 1.5s | 0.4s (cached) |
| Insights access check | Axios call | Instant (useFeature) |
| Payload size | ~500KB | ~150KB (structured) |
| API calls per session | ~50 | ~12 |

---

## Rollback Plan

If issues arise:
1. Keep old `normalizeBiomarkerStatus()` function as fallback
2. Add feature flag in backend: `use_backend_normalization: false`
3. If true, frontend falls back to old logic
4. Log all biomarker status mismatches to Sentry

```jsx
// Fallback pattern
const biomarkers = biomarkerData?.biomarkers || [];
const useBackendNorm = biomarkerData?.use_backend_normalization !== false;

if (!useBackendNorm) {
  // Use old logic temporarily
  biomarkers = biomarkers.map(b => ({
    ...b,
    status: normalizeBiomarkerStatus(b),
  }))
}
```
