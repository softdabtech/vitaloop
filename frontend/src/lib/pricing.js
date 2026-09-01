export const PRICING_PLAN_IDS = {
  FREE: 'free',
  PERSONAL: 'personal',
  PRACTITIONER: 'practitioner',
  ENTERPRISE: 'enterprise',
}

export const LANDING_PRICING_PLANS = [
  {
    id: PRICING_PLAN_IDS.FREE,
    name: 'Free / Starter',
    monthly: '$0',
    yearly: '$0',
    period: '',
    desc: 'Start with core insights for your first reports.',
    badge: null,
    dark: false,
    cta: 'Start Free',
    features: [
      { text: '1-2 analyses per month', ok: true },
      { text: 'Basic flags and summary', ok: true },
      { text: 'Full protocols', ok: false },
      { text: 'Timeline tracking', ok: false },
      { text: 'Practitioner CRM tools', ok: false },
    ],
  },
  {
    id: PRICING_PLAN_IDS.PERSONAL,
    name: 'Premium',
    // Corrected 2026-09-01: had drifted to $19.99/mo, $199/yr — the actual
    // price everywhere else (FAQ.jsx, helpArticles.js, backend email
    // templates) is $4.99/mo, $49.99/yr. This is the value every paywall
    // prompt reads via PREMIUM_PRICE_LABEL below, so fixing it here fixes
    // all of them at once.
    monthly: '$4.99',
    yearly: '$49.99',
    period: '/mo',
    annualNote: 'Save 17% on yearly billing',
    desc: 'Full blood test analysis, personalized protocol, and weekly check-ins.',
    badge: 'MOST POPULAR',
    dark: false,
    featured: true,
    cta: 'Get Premium',
    features: [
      { text: 'Full analysis of blood tests', ok: true },
      { text: 'Prioritized problem list', ok: true },
      { text: 'Personalized action protocol', ok: true },
      { text: 'Weekly AI check-ins', ok: true },
      { text: 'Progress tracking', ok: true },
    ],
  },
  {
    id: PRICING_PLAN_IDS.PRACTITIONER,
    name: 'Practitioner Premium',
    monthly: '$29',
    yearly: '$299',
    period: '/mo',
    annualNote: 'Annual option available',
    desc: 'Everything in Personal plus CRM workflows and white-label reporting.',
    badge: 'FOR PROFESSIONALS',
    dark: false,
    premium: true,
    cta: 'Get Practitioner Premium',
    features: [
      { text: 'Everything in Premium', ok: true },
      { text: 'Built-in practitioner CRM', ok: true },
      { text: 'White-label reports', ok: true },
      { text: 'Up to 10 patients', ok: true },
      { text: 'Team collaboration workflows', ok: true },
    ],
  },
  {
    id: PRICING_PLAN_IDS.ENTERPRISE,
    name: 'Enterprise',
    monthly: '$99',
    yearly: 'Custom',
    period: '/mo+',
    pricePrefix: 'From',
    annualNote: '5 seats included in entry plan',
    desc: 'Multi-tenancy CRM, API access, and advanced org-level controls.',
    badge: null,
    dark: false,
    cta: 'Contact Sales',
    features: [
      { text: 'Full multi-tenancy CRM', ok: true },
      { text: 'API access', ok: true },
      { text: 'Role-based organization control', ok: true },
      { text: 'Dedicated support', ok: true },
      { text: 'Custom integrations', ok: true },
    ],
  },
]

export const CLIENT_PREMIUM_PLAN = LANDING_PRICING_PLANS.find((plan) => plan.id === PRICING_PLAN_IDS.PERSONAL)
export const PREMIUM_MONTHLY_PRICE = 4.99
export const PREMIUM_PRICE_LABEL = `${CLIENT_PREMIUM_PLAN.monthly} / month`