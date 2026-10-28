import api from './api.js'

/** Redirect the authenticated user to Creem's hosted checkout. */
export async function openCreemCheckout(plan) {
  const { data } = await api.post('/creem/checkout', { plan })
  if (!data?.checkout_url) throw new Error('Checkout URL was not returned')
  window.location.assign(data.checkout_url)
}

/** Open Creem's hosted self-service billing portal. */
export async function openCreemBillingPortal() {
  const { data } = await api.post('/creem/portal')
  if (!data?.portal_url) throw new Error('Billing portal URL was not returned')
  window.location.assign(data.portal_url)
}
