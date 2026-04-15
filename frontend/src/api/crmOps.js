import { crmClient } from './crmClient.js'

export function getFunnelOverview(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/admin/funnel-overview${suffix}`)
}
