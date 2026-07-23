# Landing Copy Glossary

Purpose: single source of truth for wording in landing content.
Scope: `frontend/src/pages/Landing.jsx` and `frontend/src/components/landing/*`.

## Canonical Product Terms
- Product name: VITALOOP
- Core promise: lab values -> prioritized actions -> execution loop
- Upload format: PDF uploads (do not claim image/photo uploads)
- Analysis scope: 85+ biomarkers
- Free plan limit: 1 active lab upload
- Premium: $4.99/month or $49.99/year
- Pro Premium: $99/month or $990/year (practitioner/teams positioning)

## Canonical Plan Names
- Free
- Premium
- Pro Premium

Do not introduce alternative plan labels like:
- Personal Premium
- Enterprise

## Canonical Feature Phrases
Use these preferred phrases consistently:
- "Upload your lab PDF"
- "Prioritized action plan"
- "Weekly check-ins on paid plans"
- "Longitudinal tracking"
- "Protocol adaptation"

Avoid near-duplicates such as:
- "Not interpretation. Execution." repeated across multiple sections
- "Comprehensive protocol with dosages" repeated in every section

## Allowed Quantitative Claims
Only use metrics that are product-grounded and currently present in app/config copy:
- 85+ biomarkers analyzed
- 1 active lab upload (Free)
- $4.99/month, $49.99/year (Premium)
- $99/month, $990/year (Pro Premium)

Avoid unsupported claims unless verified with source data:
- Free-to-paid conversion percentages
- Guaranteed timeline outcomes (for example fixed weeks to results)
- Before/after biomarker numbers presented as universal outcomes

## Messaging Guardrails
- Prefer operational language over hype.
- Keep claims specific and verifiable.
- Keep one main idea per section:
  - Hero: value proposition + CTA
  - Timeline: process steps
  - Pricing: plan differences
  - FAQ: constraints and explanations

## Section Ownership (Source of Truth)
- Hero messaging: `LightHero.jsx`
- KPI strip: `StatsBar.jsx`
- Process loop copy: `HowItWorksTimeline.jsx`
- Pricing plan copy: `InteractivePricing.jsx`
- FAQ answers shown to users: `AnimatedFAQ.jsx`
- FAQ schema copy for SEO: `Landing.jsx` (`FAQ_ITEMS` and `SCHEMA_FAQ`)

When updating FAQ text, always update both:
1. `AnimatedFAQ.jsx`
2. `Landing.jsx` FAQ schema source

## Pre-merge Copy Checklist
1. No mention of image/photo uploads.
2. Plan names are exactly Free/Premium/Pro Premium.
3. Prices match canonical values.
4. No duplicated slogans across hero/timeline/pricing.
5. FAQ UI text and FAQ schema text are aligned.
