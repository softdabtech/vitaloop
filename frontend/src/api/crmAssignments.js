import { crmClient } from './crmClient.js'

export function assignProgramToClient(payload) {
  return crmClient.post('/crm/client-programs', payload)
}

export function getClientProgram(assignmentId) {
  return crmClient.get(`/crm/client-programs/${assignmentId}`)
}

export function startClientProgram(assignmentId) {
  return crmClient.post(`/crm/client-programs/${assignmentId}/start`, {})
}

export function pauseClientProgram(assignmentId) {
  return crmClient.post(`/crm/client-programs/${assignmentId}/pause`, {})
}

export function addIntervention(assignmentId, payload) {
  return crmClient.post(`/crm/client-programs/${assignmentId}/interventions`, {
    ...payload,
    client_program_id: assignmentId,
  })
}
