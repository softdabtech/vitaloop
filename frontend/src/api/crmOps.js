import { crmClient } from './crmClient.js'

export function getFunnelOverview(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  if (params.minDropoffReached) query.set('min_dropoff_reached', String(params.minDropoffReached))
  if (params.dropoffSort) query.set('dropoff_sort', String(params.dropoffSort))
  if (params.dropoffLimit) query.set('dropoff_limit', String(params.dropoffLimit))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/admin/funnel-overview${suffix}`)
}

export function getClaudeUsage(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/ops/claude-usage${suffix}`)
}

export function getOpenAIUsage(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/ops/openai-usage${suffix}`)
}
