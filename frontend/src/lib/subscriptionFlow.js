export const SUBSCRIPTION_PLAN_IDS = {
  FREE: 'free',
  PERSONAL: 'personal',
  PRACTITIONER: 'practitioner',
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

export function getCabinetUpgradeTarget(planName) {
  if (planName === SUBSCRIPTION_PLAN_IDS.PRACTITIONER) {
    return null
  }

  if (planName === SUBSCRIPTION_PLAN_IDS.PERSONAL) {
    return {
      planId: SUBSCRIPTION_PLAN_IDS.PRACTITIONER,
      label: 'Upgrade to Pro Premium',
    }
  }

  return {
    planId: SUBSCRIPTION_PLAN_IDS.PERSONAL,
    label: 'Upgrade to Premium',
  }
}