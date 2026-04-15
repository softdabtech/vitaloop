import { crmClient } from './crmClient.js'

export function getClients(params = {}) {
  const query = new URLSearchParams()
  if (params.limit) query.set('limit', String(params.limit))
  if (params.offset) query.set('offset', String(params.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return crmClient.get(`/crm/clients${suffix}`)
}

export function getClientById(clientId) {
  return crmClient.get(`/crm/clients/${clientId}`)
}

export function updateClient(clientId, payload) {
  return crmClient.patch(`/crm/clients/${clientId}`, payload)
}
