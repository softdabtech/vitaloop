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
