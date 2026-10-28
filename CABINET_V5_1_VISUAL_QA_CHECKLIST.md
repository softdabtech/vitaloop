# Cabinet V5.1 Visual QA Checklist

Date: 2026-06-30
Scope: End-user cabinet visual consistency, interactions, and responsive behavior.

## Global Visual System
- Typography loads correctly: Manrope body, Space Grotesk headings.
- Header hierarchy is consistent across cabinet pages.
- Primary buttons use gradient style and elevated hover state.
- Secondary buttons keep consistent shape, contrast, and hover.
- All major cards use consistent border, radius, and shadow treatment.
- No legacy Cabinet version labels visible in the UI.

## Dashboard (Today)
- Progress section shows completion percentage.
- Progress section shows gradient progress bar and stage ETA.
- Stage cards show status state (done, active, upcoming).
- Active stage shows "Now" marker.
- Weekly momentum mini-chart renders correctly.
- Smart stage action buttons navigate to the correct pages.
- Mobile compact timeline renders instead of desktop stage grid.

## Key Cabinet Pages
- Symptom Check page header and card style matches dashboard visual system.
- Lab Plan page buttons and cards follow shared visual language.
- Upload page card style and CTA buttons match system.
- Results and Protocol pages keep consistent top hierarchy and action controls.
- Check-in, Settings, Subscription, Help Center all share consistent card/button style.

## Desktop QA (>= 1280px)
- Sidebar + content layout remains stable without overflow.
- Header actions do not wrap unexpectedly.
- Card spacing is visually balanced and consistent.
- Hover animations are subtle and do not jitter.

## Tablet QA (768px - 1279px)
- Grid sections collapse gracefully.
- Buttons remain readable and touch friendly.
- Progress and smart action modules remain understandable.

## Mobile QA (< 768px)
- Compact progress timeline appears.
- All CTAs remain reachable without horizontal scroll.
- Cards keep readable spacing and text line-length.
- Bottom navigation does not overlap content.

## Accessibility and Motion
- Focus states visible on interactive elements.
- Reduced motion mode disables reveal animation.
- Text contrast remains acceptable on all cards and buttons.

## Smoke Navigation Paths
- /dashboard -> /questionnaire
- /dashboard -> /lab-plan
- /dashboard -> /upload
- /dashboard -> /assignments
- /dashboard -> /check-ins
- /dashboard -> /lab-results
- /settings -> /dashboard

## Production Verification
- Hard refresh shows latest styles and scripts.
- No console errors that block rendering.
- No broken icons, missing fonts, or unstyled sections.
