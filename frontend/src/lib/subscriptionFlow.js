export const SUBSCRIPTION_PLAN_IDS = {
  FREE: 'free',
  PERSONAL: 'personal',
  PRACTITIONER: 'practitioner',
}

function normalizePlanName(planName) {
  const raw = String(planName || '').toLowerCase().trim()

  if (!raw) return SUBSCRIPTION_PLAN_IDS.FREE
  if (['practitioner', 'practitioner_premium', 'enterprise', 'pro', 'pro_premium'].includes(raw)) {
    return SUBSCRIPTION_PLAN_IDS.PRACTITIONER
  }
  if (['personal', 'personal_pro', 'premium', 'active', 'trialing'].includes(raw)) {
    return SUBSCRIPTION_PLAN_IDS.PERSONAL
  }

  return SUBSCRIPTION_PLAN_IDS.FREE
}

export function buildSubscriptionPath({ planId = null, billingCycle = 'monthly' } = {}) {
  const params = new URLSearchParams()

  if (planId) {
    params.set('plan', planId)
  }

  if (billingCycle) {
    params.set('billing', billingCycle)
  }

  const query = params.toString()
  return query ? `/subscription?${query}` : '/subscription'
}

export function buildSignupPath({ returnUrl } = {}) {
  const params = new URLSearchParams({ signup: 'true' })

  if (returnUrl) {
    params.set('returnUrl', returnUrl)
  }

  return `/login?${params.toString()}`
}

export function buildSignupRedirect({ planId = null, billingCycle = 'monthly' } = {}) {
  return buildSignupPath({ returnUrl: buildSubscriptionPath({ planId, billingCycle }) })
}

export function getCabinetUpgradeTarget(planName, isPremium = false, locale = 'en') {
  const normalizedPlan = normalizePlanName(planName)
  const isUk = String(locale || '').toLowerCase().startsWith('uk')

  if (normalizedPlan === SUBSCRIPTION_PLAN_IDS.PRACTITIONER) {
    return null
  }

  if (normalizedPlan === SUBSCRIPTION_PLAN_IDS.PERSONAL || isPremium) {
    return {
      planId: SUBSCRIPTION_PLAN_IDS.PRACTITIONER,
      label: isUk ? 'Перейти на Pro Premium' : 'Upgrade to Pro Premium',
    }
  }

  return {
    planId: SUBSCRIPTION_PLAN_IDS.PERSONAL,
    label: isUk ? 'Перейти на Premium' : 'Upgrade to Premium',
  }
}
