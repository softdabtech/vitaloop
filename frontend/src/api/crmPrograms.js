import { crmClient } from './crmClient.js'

export function getPrograms(params = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.offset) query.set('offset', String(params.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/programs${suffix}`)
}

export function getProgramById(programId) {
  return crmClient.get(`/crm/programs/${programId}`)
}

export function createProgram(payload) {
  return crmClient.post('/crm/programs', payload)
}
