# VITALOOP Architecture Improvements - Implementation Plan

## ✅ COMPLETED

### 1. Centralized Data Caching (React Query)
- **Status**: IMPLEMENTED
- **Files**: 
  - `src/hooks/useQueries.js` - Query hooks for all endpoints
  - `src/main.jsx` - QueryClientProvider setup
  
**Usage**:
```jsx
import { useDashboardSummary } from '@/hooks/useQueries'

export function UserDashboard() {
  const { data, isLoading, error } = useDashboardSummary()
  // data is cached for 5 mins, auto-refetch on tab focus
}
```

**Benefits**: 
- ✅ Automatic deduplication - same query called twice = 1 API call
- ✅ Auto-refresh on tab focus (window focus event)
- ✅ Offline support ready (PWA can work with stale cache)
- ✅ Instant page navigation (cached data shows immediately)

**Next Steps**:
- [ ] Update UserDashboard.jsx to use `useDashboardSummary()`
- [ ] Update Progress.jsx to use `useProgress()`
- [ ] Update Insights page to use `useInsights()`
- [ ] Add React Query DevTools for debugging: `import { ReactQueryDevtools } from '@tanstack/react-query-devtools'`

---

## 🔴 TODO - CRITICAL

### 2. Backend: Single Source of Truth for Biomarker Logic
**Problem**: 
- Biomarker status calculation duplicated in frontend (Results.jsx) and backend
- STATUS_META hardcoded in multiple places
- No central place to add ML confidence scoring

**Solution**:
```typescript
// POST /biomarker/normalize/{labId}
// Returns:
{
  biomarkers: [
    {
      id: "ferritin",
      value: 14,
      reference_range: "30-400",
      status: "LOW",           // Single source
      color: "red",            // Single source
      severity_rank: 1,        // Priority
      confidence: 0.98,        // ML model confidence
      recommendation: "Start with iron supplementation"
    }
  ]
}
```

**Why**: 
- Frontend calls once, caches via React Query
- No logic duplication
- Easy to add ML confidence scoring
- A/B testing different algorithms server-side

**Effort**: 4-6 hours backend work

---

### 3. Feature Flags + Paywall as Single System
**Problem**:
- PremiumRoute, Paywall, LockedFeatureOverlay - 3 different approaches
- Feature logic scattered across 5+ components
- Hard to add trial periods, A/B test features, or manage permissions

**Solution**:

```typescript
// GET /user/entitlements
{
  free_tier: {
    uploads: 1,
    dashboard: true,
    insights: false,
    protocols: false,
    assignments: false,
    trial_expires: null
  },
  premium_tier: {
    uploads: Infinity,
    dashboard: true,
    insights: true,
    protocols: true,
    assignments: true,
    trial_expires: "2026-05-15T00:00:00Z"
  },
  active_tier: "premium_tier",
  can_upgrade: false,
  billing_next_date: "2026-06-01"
}
```

**Usage**:
```jsx
import { useUserEntitlements } from '@/hooks/useQueries'
import { FeatureGate } from '@/components/FeatureGate'

export function InsightsPage() {
  const { data: entitlements } = useUserEntitlements()
  
  if (!entitlements?.active_tier.insights) {
    return <PaywallModal feature="insights" />
  }
  
  return <InsightsContent />
}
```

**Or with FeatureGate component**:
```jsx
<FeatureGate feature="insights" onLocked={handleUpgrade}>
  <InsightsContent />
</FeatureGate>
```

**Benefits**:
- Single source of truth for all feature access
- Easy A/B testing (different entitlements per user group)
- Trial periods managed server-side
- Mobile app & web app in sync
- One place to audit who has what access

**Effort**: 6-8 hours (backend API + frontend FeatureGate component)

---

## 🟡 MEDIUM PRIORITY

### 4. Landing Page Issues (from user feedback)
- [ ] Remove "Traditional Labs vs VITALOOP" aggressive red X styling
- [ ] Fix "How It Works" duplication (have 2 versions)
- [ ] Make Testimonials carousel show all 3 testimonials properly
- [ ] Expand "Premium Features" with more context
- [ ] Make FAQ items open 2-3 by default
- [ ] Make "Watch demo" button open modal/video, not /login
- [ ] Add count-up animation to stats

---

## 📋 MIGRATION CHECKLIST

Once React Query is set up, migrate pages in this order:

1. **UserDashboard.jsx**
   ```jsx
   // OLD
   const [summary, setSummary] = useState(null)
   useEffect(() => {
     api.get('/dashboard/summary').then(res => setSummary(res.data))
   }, [])
   
   // NEW
   const { data: summary, isLoading } = useDashboardSummary()
   ```

2. **Progress.jsx** - Similar pattern, use `useProgress()`

3. **Insights.jsx** - Use `useInsights()`

4. **Lab Results pages** - Use `useLabResults(labId)`

5. Add to App.jsx or per-route basis:
   ```jsx
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
   
   <QueryClientProvider client={queryClient}>
     <App />
     <ReactQueryDevtools initialIsOpen={false} />
   </QueryClientProvider>
   ```

---

## Performance Metrics (Expected)

| Metric | Before | After | Benefit |
|--------|--------|-------|---------|
| API calls per session | ~50 | ~15 | -70% |
| Page navigation time | 1.2s | 0.3s | 4x faster |
| Network bandwidth | 2.4 MB | 0.8 MB | -67% |
| User perception | "app feels slow" | "instant" | Better UX |

---

## Testing Checklist

- [ ] Open DevTools React Query tab, verify cache hits
- [ ] Click between Dashboard → Progress → Dashboard, see cached data load instantly
- [ ] Close browser, reopen on PWA - see offline cache fallback
- [ ] Open app in 2 tabs, refetch in one - see other tab auto-update
- [ ] Network throttle to "Slow 4G", verify graceful degradation
