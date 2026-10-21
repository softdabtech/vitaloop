# VITALOOP visual-system migration plan

## Goal and non-negotiable safety rule

Move the public site and end-user cabinet to the approved VITALOOP foundation
tokens without changing navigation, copy, data presentation, access controls,
or clinical-status meaning. A route is migrated only after a visual comparison
at desktop and mobile widths confirms that its information hierarchy and all
interactive states remain intact.

The canonical tokens live in
[`frontend/src/styles/design-tokens.css`](../frontend/src/styles/design-tokens.css).
They are additive in phase 0: no existing alias or component changes merely
because the file is imported.

## Target component contract

| Primitive | Required visual contract |
| --- | --- |
| Primary action | `brand-700` fill, white text, 44px minimum height, pill radius, `shadow-primary` only while actionable. |
| Secondary action | White surface, `border-strong`, ink text, same height/radius as primary. |
| Destructive action | Outline by default; solid red only in the final irreversible confirmation. |
| Card | White surface, `radius-card`, `shadow-card`; clinical importance is conveyed by a labelled status, not card tint alone. |
| Field | 12px radius, clear label, 16px text on mobile, brand focus ring. |
| Status | `Stable`, `Monitor`, `Review`, `Unavailable`; text and icon accompany every colour. |
| Table | Neutral row dividers, tabular numeric values, no colour-only results. |

## Migration sequence

### Phase 0 — foundation and inventory

**Deliverable:** `design-tokens.css`, this plan, and baseline screenshots.

1. Keep `--brand`, `--coach-*`, `--cabinet-*`, Tailwind config, and existing
   classes unchanged.
2. Capture desktop (1440px) and mobile (390px) baselines for the routes below
   using synthetic/local data only. Include default, loading, empty, error,
   disabled and populated states where the route provides them.
3. Record each screenshot beside the change set; use fixed browser zoom,
   locale and fixture content.

**Exit gate:** importing the token file causes no rendered change on a clean
build; the existing test suite passes.

### Phase 1 — shared primitives before screens

Migrate and snapshot-test these components first. Do not update page markup
until their API and states are stable.

| Order | Component | Replacement / rule |
| --- | --- | --- |
| 1 | `CoachButton` and `.cabinet-btn` | Make both consume `--vtl-action-*`, shared 44/40px sizes, one focus ring. Keep class names during the transition. |
| 2 | `CoachCard` and `.cabinet-card` | Map card surface, radius and shadow to the canonical token values. |
| 3 | `CoachBadge`, `StatusBadge`, biomarker status mapping | Map data states to the four semantic statuses; retain the original API response labels. |
| 4 | Inputs, selects, upload dropzone | Map border, radius, typography, focus and disabled states. |
| 5 | Toast, cookie consent, empty/loading/error states | Remove isolated hard-coded palette values and adopt the same surface/text/status tokens. |

**Exit gate:** Story-like fixture pages or component tests cover normal,
hover/focus, disabled, error and mobile wrapping states. No component may
introduce a raw `#` colour outside the token file without a documented reason.

### Phase 2 — cabinet core journey

Migrate in the order a member encounters the product. This limits the number
of simultaneously changing visual systems and preserves the meaning of clinical
information.

| Route | Scope | Regression checks |
| --- | --- | --- |
| `/dashboard` | Shell canvas, side/bottom nav, today cards and hero CTA. | Desktop collapsed/expanded sidebar; 390px bottom navigation; returning and empty dashboard. |
| `/questionnaire` | Progress, choice chips, information and warning blocks. | First/last step, validation, saved state, Ukrainian copy wrapping. |
| `/lab-plan` | Recommendation cards, priority badges, action pair. | Empty plan, completed item, long test name and mobile wrap. |
| `/upload` | Dropzone, workflow progress, errors and primary upload CTA. | PDF/image state, disabled upload, upload error, 390px target sizes. |
| `/lab-results` | History cards, filter controls, result states. | Empty history, awaiting analysis, ready and failed/partial result. |
| `/results/:uploadId` | Summary, clinical-status badges, table, action plan CTA. | Latest/historical report, `Review` status, unknown values, desktop table and 390px table. |
| `/protocol/:uploadId` | Action cards, clinician escalation, retest and export action. | No protocol, partial protocol, safety notice, export disabled/enabled. |

**Exit gate per route:** screenshot diff reviewed at 1440px and 390px; keyboard
focus visible; no loss of data, wording, action availability or status labels.

### Phase 3 — account, commercial and support screens

| Route | Scope | Key decision |
| --- | --- | --- |
| `/health-profile` | Profile fields and selection cards. | Fields are first-class primitives, not card variants. |
| `/account` | Account/security panels and destructive flows. | One button family only; destructive fill is reserved for final confirmation. |
| `/subscription`, `/billing-history` | Plan cards, support and billing actions. | Brand teal for a purchase/continue action; blue is informational only. |
| `/help-center`, `/help` | Search, category cards, article typography. | Editorial content uses the same neutral scale, not a separate app theme. |

### Phase 4 — public acquisition and trust journey

| Route | Scope | Key decision |
| --- | --- | --- |
| `/` and marketing pages | Align CTA, card, badge and form primitives to the foundation layer. | Preserve hero imagery/layout; do not redesign copy or conversion structure in this phase. |
| `/login`, `/auth/confirmation` | Replace SF/Apple typography, blue `#007AFF` and emoji-led state treatment. | Match the approved components while retaining all auth states and provider actions. |
| `/ua` and UA marketing pages | Keep Ukrainian cues as content/illustration accents only. | Product controls remain foundation teal; do not create a second CTA palette. |
| `/terms`, `/privacy-policy`, policy pages | Replace inline legacy fallback variables with content tokens. | Legal content stays calm, readable and visibly part of VITALOOP. |

## Visual-regression protocol

For every PR or release batch:

1. Start from an unchanged baseline commit and use the same synthetic fixture.
2. Capture each changed route at 1440px and 390px, at 100% zoom.
3. Compare: header/nav position, title and CTA hierarchy, text wrapping,
   card order, table columns, all semantic statuses, focus ring, and fixed
   elements such as cookie consent or the mobile bottom bar.
4. Treat these as release blockers: clipped controls, CTA overlap, changed
   clinical-status meaning, missing error/empty/loading state, or contrast
   regression.
5. Permit only intentional visual deltas documented in the PR with before/after
   screenshots and the route's exit gate.

## Out of scope

This plan covers the public marketing site and end-user cabinet. The dark CRM
interface is a separate operational surface and should receive its own token
mapping after the end-user visual language is stable.
