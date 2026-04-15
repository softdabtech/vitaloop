import { crmClient } from './crmClient.js'

export function getPractitioners() {
  return crmClient.get('/crm/practitioners')
}

export function getPractitionerById(practitionerId) {
  return crmClient.get(`/crm/practitioners/${practitionerId}`)
}

export function createPractitioner(payload) {
  return crmClient.post('/crm/practitioners', payload)
}

export function assignPractitioner(payload) {
  return crmClient.post('/crm/practitioners/assign', payload)
}
