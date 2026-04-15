import { crmClient } from './crmClient.js'

export function getQuestionnaire(questionnaireId) {
  return crmClient.get(`/crm/questionnaires/${questionnaireId}`)
}

export function submitQuestionnaire(payload) {
  return crmClient.post('/crm/questionnaires/submit', payload)
}

export function getAuditLogs(params = {}) {
  const query = new URLSearchParams()
  if (params.entityType) query.set('entity_type', params.entityType)
  if (params.userId) query.set('user_id', params.userId)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/audit-logs${suffix}`)
}
