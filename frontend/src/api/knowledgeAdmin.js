import { crmClient } from './crmClient.js'

function toQueryString(params) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export function listKnowledgeRules(filters = {}) {
  return crmClient.get(`/knowledge/rules${toQueryString(filters)}`)
}

export function getKnowledgeRule(ruleId) {
  return crmClient.get(`/knowledge/rules/${ruleId}`)
}

export function getKnowledgeRuleAudit(ruleId, limit = 200) {
  return crmClient.get(`/knowledge/rules/${ruleId}/audit?limit=${limit}`)
}

export function updateKnowledgeRule(ruleId, payload) {
  return crmClient.patch(`/knowledge/rules/${ruleId}`, payload)
}

export function submitKnowledgeRuleReview(ruleId, payload) {
  return crmClient.post(`/knowledge/rules/${ruleId}/submit-review`, payload)
}

export function approveKnowledgeRule(ruleId, payload) {
  return crmClient.post(`/knowledge/rules/${ruleId}/approve`, payload)
}

export function deprecateKnowledgeRule(ruleId, payload) {
  return crmClient.post(`/knowledge/rules/${ruleId}/deprecate`, payload)
}

export function createDraftCopy(ruleId, payload) {
  return crmClient.post(`/knowledge/rules/${ruleId}/create-draft-copy`, payload)
}

export function listKnowledgeRecommendations() {
  return crmClient.get('/knowledge/recommendations')
}

export function getKnowledgeRecommendation(recommendationId) {
  return crmClient.get(`/knowledge/recommendations/${recommendationId}`)
}
