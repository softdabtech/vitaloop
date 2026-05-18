import { crmClient } from './crmClient.js'

export function getOpsMetrics() {
  return crmClient.get('/crm/ops/metrics')
}

export function syncUsersToOps() {
  return crmClient.post('/crm/ops/sync-users', {})
}

export function ensureTrigger() {
  return crmClient.post('/crm/ops/ensure-trigger', {})
}

export function getClaudeUsage(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/ops/claude-usage${suffix}`)
}

export function getActiveClientActivity(params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/ops/active-client-activity${suffix}`)
}

export function getUserActivityDetail(userId, params = {}) {
  const query = new URLSearchParams()
  if (params.days) query.set('days', String(params.days))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/ops/users/${userId}/activity${suffix}`)
}
